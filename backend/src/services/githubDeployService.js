const {exec}=require('child_process')
const {promisify}=require('util')//promisify() ek function hai jo callback-based function ko promise-based banata hai (taaki await use kar sako)
const execAsync =promisify(exec)//exec normally callback leta hai,isko promisify karke execAsync bana diya jisse hm await execAsync("docker ps") jaisa likh sako.
const fs= require('fs').promises;
const path =require('path')
const logger =require('../utils/logger')

class GitHubDeployService{
    constructor(){
        this.runningContainers=new Map();
        this.usedPorts=new Set();
        this.basePort=3000;
        this.maxPort=4000;
        this.ec2PublicIp=process.env.EC2_PUBLIC_IP || 'localhost';
        this.cleanupInterval=this.startCleanupScheduler();
    }

    async getAvailablePort(){
        for(let port=this.basePort;port<=this.maxPort;port++){
            if(!this.usedPorts.has(port)){
                try{
                    const{stdout}=await execAsync(`netstat -tuln | grep :${port}`);
                    if(!stdout.trim()){
                        this.usedPorts.add(port)
                        return port;
                    }
                }catch(error){
                    this.usedPorts.add(port)
                    return port;
                }
            }
        }
        throw new Error('No available ports');
    }

    validateGitHubUrl(url){
        const githubRegex = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/;
        return githubRegex.test(url);
    }

    async cloneRepository(githubUrl,taskId){
        const cloneDir=path.join(process.cwd(),'temp',taskId);
        try{
            await fs.mkdir(cloneDir,{recursive:true})
            await execAsync(`git clone ${githubUrl} ${cloneDir}`)
            const dockerfilePath=path.join(cloneDir,'Dockerfile')
            await fs.access(dockerfilePath);
            return cloneDir;
        }catch(error){
            try{
                await fs.rm(cloneDir,{recursive:true,force:true})
            }catch(cleanUpError){
                logger.warn('Failed to cleanup clone directory', { error: cleanUpError.message }); 
            }
            throw new Error(`Failed to clone repository or Dockerfile not found: ${error.message}`);
        }
    }

    async buildDockerImage(cloneDir,taskId){
        const imageName = `github-deploy-${taskId}`.toLowerCase();
        try{
            const buildCommand=`docker build -t ${imageName} ${cloneDir}`;
            const {stdout,stderr}=await execAsync(buildCommand,{
                maxBuffer: 1024 * 1024 * 10,
                timeout: 600000
            });
            
            // Check if the build actually succeeded by verifying the image exists
            try {
                await execAsync(`docker images ${imageName} --format "{{.ID}}"`);
            } catch (imageCheckError) {
                throw new Error(`Docker image was not created successfully: ${imageCheckError.message}`);
            }
            
            logger.info(`Docker build completed for task ${taskId}`,{
                stdout: stdout.slice(-500),
                stderr: stderr.slice(-500)
            });
            
            return {
                imageName,
                buildLogs: stdout + stderr
            };
        }catch(error){
            // Only treat as error if it's not just deprecation warnings
            if (error.code && error.code !== 0) {
                // Check if stderr contains actual errors vs just warnings
                const errorOutput = error.stderr || error.message || '';
                const isOnlyWarnings = errorOutput.includes('DEPRECATED') && 
                                     !errorOutput.includes('ERROR') && 
                                     !errorOutput.includes('failed') &&
                                     !errorOutput.includes('Error');
                
                if (!isOnlyWarnings) {
                    logger.error(`Docker build failed for task ${taskId}`, { 
                        error: error.message,
                        stderr: error.stderr,
                        stdout: error.stdout
                    });
                    throw new Error(`Docker build failed: ${error.message}`);
                } else {
                    // It's just warnings, check if image was created
                    try {
                        await execAsync(`docker images ${imageName} --format "{{.ID}}"`);
                        logger.info(`Docker build completed with warnings for task ${taskId}`);
                        return {
                            imageName,
                            buildLogs: (error.stdout || '') + (error.stderr || '')
                        };
                    } catch (imageCheckError) {
                        throw new Error(`Docker build failed: ${error.message}`);
                    }
                }
            } else {
                logger.error(`Docker build failed for task ${taskId}`, { error: error.message });
                throw new Error(`Docker build failed: ${error.message}`);
            }
        }finally{
            try{
                await fs.rm(cloneDir,{recursive:true,force:true})
            }catch(cleanUpError){
                logger.warn('Failed to cleanup clone directory', { error: cleanUpError.message }); 
            }
        }
    }

    async runContainer(imageName,taskId,port){
        try{
            const containerName=`github-deploy-${taskId}`;
            const runCommand=`docker run -d --name ${containerName} -p ${port}:3000 ${imageName}`;
            const {stdout}=await execAsync(runCommand)
            const containerId=stdout.trim();
            await new Promise(resolve=>setTimeout(resolve,2000));
            const { stdout: psOutput } = await execAsync(`docker ps --filter "id=${containerId}" --format "{{.Status}}"`);
            if (!psOutput.trim()) {
                throw new Error('Container failed to start');
            }
            const publicUrl = `http://${this.ec2PublicIp}:${port}`;
            const scheduledStopTime=new Date(Date.now()+60*60*1000);
            this.runningContainers.set(containerId,{
                taskId,port,imageName,scheduledStopTime,containerName
            });
            logger.info(`Container started for task ${taskId}`, { 
                containerId: containerId.slice(0, 12), 
                publicUrl,
                scheduledStopTime 
            });
            
            return {
                containerId,
                publicUrl,
                scheduledStopTime
            };
        }catch (error) {
            this.usedPorts.delete(port);
            throw new Error(`Failed to run container: ${error.message}`);
        }
    }
    
    async stopContainer(containerId){
        try{
            const containerInfo=this.runningContainers.get(containerId);
            if(!containerInfo){
                logger.warn(`Container ${containerId} not found in running containers`);
                return;
            }
            await execAsync(`docker stop ${containerId}`);
            await execAsync(`docker rm ${containerId}`);
            try{
                await execAsync(`docker rmi ${containerInfo.imageName}`);
            }catch (imageError) {
                logger.warn(`Failed to remove image ${containerInfo.imageName}`, { error: imageError.message });
            }
            this.usedPorts.delete(containerInfo.port);
            this.runningContainers.delete(containerId);
            
            logger.info(`Container ${containerId.slice(0, 12)} stopped and cleaned up`);
        } catch (error) {
            logger.error(`Failed to stop container ${containerId}`, { error: error.message });
            throw error;
        }
    }

    async getContainerStatus(containerId) {
        try {
            const { stdout } = await execAsync(`docker ps -a --filter "id=${containerId}" --format "{{.Status}}"`);
            return stdout.trim();
        } catch (error) {
            return 'unknown';
        }
    }

    startCleanupScheduler() {
        return setInterval(async () => {
            const now = new Date();
            const containersToStop = [];
            
            for (const [containerId, info] of this.runningContainers) {
                if (now >= info.scheduledStopTime) {
                    containersToStop.push(containerId);
                }
            }
            
            for (const containerId of containersToStop) {
                try {
                    await this.stopContainer(containerId);
                    logger.info(`Automatically stopped container ${containerId.slice(0, 12)} after 1 hour`);
                } catch (error) {
                    logger.error(`Failed to auto-stop container ${containerId}`, { error: error.message });
                }
            }
        }, 60000); 
    }

    async cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        const containerIds = Array.from(this.runningContainers.keys());
        await Promise.all(containerIds.map(id => this.stopContainer(id).catch(err => 
            logger.error(`Failed to stop container ${id} during cleanup`, { error: err.message })
        )));
    }

    getRunningContainers() {
        return Array.from(this.runningContainers.entries()).map(([containerId, info]) => ({
            containerId: containerId.slice(0, 12),
            taskId: info.taskId,
            port: info.port,
            scheduledStopTime: info.scheduledStopTime,
            timeRemaining: Math.max(0, info.scheduledStopTime - new Date())
        }));
    }
}

module.exports = new GitHubDeployService();