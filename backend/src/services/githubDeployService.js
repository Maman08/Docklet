// const {exec}=require('child_process')
// const {promisify}=require('util')//promisify() ek function hai jo callback-based function ko promise-based banata hai (taaki await use kar sako)
// const execAsync =promisify(exec)//exec normally callback leta hai,isko promisify karke execAsync bana diya jisse hm await execAsync("docker ps") jaisa likh sako.
// const fs= require('fs').promises;
// const path =require('path')
// const logger =require('../utils/logger')

// class GitHubDeployService{
//     constructor(){
//         this.runningContainers=new Map();
//         this.usedPorts=new Set();
//         this.basePort=3000;
//         this.maxPort=4000;
//         this.ec2PublicIp=process.env.EC2_PUBLIC_IP || 'localhost';
//         this.cleanupInterval=this.startCleanupScheduler();
//     }

//     async getAvailablePort(){
//         for(let port=this.basePort;port<=this.maxPort;port++){
//             if(!this.usedPorts.has(port)){
//                 try{
//                     const{stdout}=await execAsync(`netstat -tuln | grep :${port}`);
//                     if(!stdout.trim()){
//                         this.usedPorts.add(port)
//                         return port;
//                     }
//                 }catch(error){
//                     this.usedPorts.add(port)
//                     return port;
//                 }
//             }
//         }
//         throw new Error('No available ports');
//     }

//     validateGitHubUrl(url){
//         const githubRegex = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/;
//         return githubRegex.test(url);
//     }

//     async cloneRepository(githubUrl,taskId){
//         const cloneDir=path.join(process.cwd(),'temp',taskId);
//         try{
//             await fs.mkdir(cloneDir,{recursive:true})
//             await execAsync(`git clone ${githubUrl} ${cloneDir}`)
//             const dockerfilePath=path.join(cloneDir,'Dockerfile')
//             await fs.access(dockerfilePath);
//             return cloneDir;
//         }catch(error){
//             try{
//                 await fs.rm(cloneDir,{recursive:true,force:true})
//             }catch(cleanUpError){
//                 logger.warn('Failed to cleanup clone directory', { error: cleanUpError.message }); 
//             }
//             throw new Error(`Failed to clone repository or Dockerfile not found: ${error.message}`);
//         }
//     }

//     async buildDockerImage(cloneDir,taskId){
//         const imageName = `github-deploy-${taskId}`.toLowerCase();
//         try{
//             const buildCommand=`docker build -t ${imageName} ${cloneDir}`;
//             const {stdout,stderr}=await execAsync(buildCommand,{
//                 maxBuffer: 1024 * 1024 * 10,
//                 timeout: 600000
//             });
            
//             // Check if the build actually succeeded by verifying the image exists
//             try {
//                 await execAsync(`docker images ${imageName} --format "{{.ID}}"`);
//             } catch (imageCheckError) {
//                 throw new Error(`Docker image was not created successfully: ${imageCheckError.message}`);
//             }
            
//             logger.info(`Docker build completed for task ${taskId}`,{
//                 stdout: stdout.slice(-500),
//                 stderr: stderr.slice(-500)
//             });
            
//             return {
//                 imageName,
//                 buildLogs: stdout + stderr
//             };
//         }catch(error){
//             // Only treat as error if it's not just deprecation warnings
//             if (error.code && error.code !== 0) {
//                 // Check if stderr contains actual errors vs just warnings
//                 const errorOutput = error.stderr || error.message || '';
//                 const isOnlyWarnings = errorOutput.includes('DEPRECATED') && 
//                                      !errorOutput.includes('ERROR') && 
//                                      !errorOutput.includes('failed') &&
//                                      !errorOutput.includes('Error');
                
//                 if (!isOnlyWarnings) {
//                     logger.error(`Docker build failed for task ${taskId}`, { 
//                         error: error.message,
//                         stderr: error.stderr,
//                         stdout: error.stdout
//                     });
//                     throw new Error(`Docker build failed: ${error.message}`);
//                 } else {
//                     // It's just warnings, check if image was created
//                     try {
//                         await execAsync(`docker images ${imageName} --format "{{.ID}}"`);
//                         logger.info(`Docker build completed with warnings for task ${taskId}`);
//                         return {
//                             imageName,
//                             buildLogs: (error.stdout || '') + (error.stderr || '')
//                         };
//                     } catch (imageCheckError) {
//                         throw new Error(`Docker build failed: ${error.message}`);
//                     }
//                 }
//             } else {
//                 logger.error(`Docker build failed for task ${taskId}`, { error: error.message });
//                 throw new Error(`Docker build failed: ${error.message}`);
//             }
//         }finally{
//             try{
//                 await fs.rm(cloneDir,{recursive:true,force:true})
//             }catch(cleanUpError){
//                 logger.warn('Failed to cleanup clone directory', { error: cleanUpError.message }); 
//             }
//         }
//     }

//     async runContainer(imageName,taskId,port){
//         try{
//             const containerName=`github-deploy-${taskId}`;
//             const runCommand=`docker run -d --name ${containerName} -p ${port}:3000 ${imageName}`;
//             const {stdout}=await execAsync(runCommand)
//             const containerId=stdout.trim();
//             await new Promise(resolve=>setTimeout(resolve,2000));
//             const { stdout: psOutput } = await execAsync(`docker ps --filter "id=${containerId}" --format "{{.Status}}"`);
//             if (!psOutput.trim()) {
//                 throw new Error('Container failed to start');
//             }
//             const publicUrl = `http://${this.ec2PublicIp}:${port}`;
//             const scheduledStopTime=new Date(Date.now()+60*60*1000);
//             this.runningContainers.set(containerId,{
//                 taskId,port,imageName,scheduledStopTime,containerName
//             });
//             logger.info(`Container started for task ${taskId}`, { 
//                 containerId: containerId.slice(0, 12), 
//                 publicUrl,
//                 scheduledStopTime 
//             });
            
//             return {
//                 containerId,
//                 publicUrl,
//                 scheduledStopTime
//             };
//         }catch (error) {
//             this.usedPorts.delete(port);
//             throw new Error(`Failed to run container: ${error.message}`);
//         }
//     }
    
//     async stopContainer(containerId){
//         try{
//             const containerInfo=this.runningContainers.get(containerId);
//             if(!containerInfo){
//                 logger.warn(`Container ${containerId} not found in running containers`);
//                 return;
//             }
//             await execAsync(`docker stop ${containerId}`);
//             await execAsync(`docker rm ${containerId}`);
//             try{
//                 await execAsync(`docker rmi ${containerInfo.imageName}`);
//             }catch (imageError) {
//                 logger.warn(`Failed to remove image ${containerInfo.imageName}`, { error: imageError.message });
//             }
//             this.usedPorts.delete(containerInfo.port);
//             this.runningContainers.delete(containerId);
            
//             logger.info(`Container ${containerId.slice(0, 12)} stopped and cleaned up`);
//         } catch (error) {
//             logger.error(`Failed to stop container ${containerId}`, { error: error.message });
//             throw error;
//         }
//     }

//     async getContainerStatus(containerId) {
//         try {
//             const { stdout } = await execAsync(`docker ps -a --filter "id=${containerId}" --format "{{.Status}}"`);
//             return stdout.trim();
//         } catch (error) {
//             return 'unknown';
//         }
//     }

//     startCleanupScheduler() {
//         return setInterval(async () => {
//             const now = new Date();
//             const containersToStop = [];
            
//             for (const [containerId, info] of this.runningContainers) {
//                 if (now >= info.scheduledStopTime) {
//                     containersToStop.push(containerId);
//                 }
//             }
            
//             for (const containerId of containersToStop) {
//                 try {
//                     await this.stopContainer(containerId);
//                     logger.info(`Automatically stopped container ${containerId.slice(0, 12)} after 1 hour`);
//                 } catch (error) {
//                     logger.error(`Failed to auto-stop container ${containerId}`, { error: error.message });
//                 }
//             }
//         }, 60000); 
//     }

//     async cleanup() {
//         if (this.cleanupInterval) {
//             clearInterval(this.cleanupInterval);
//         }
        
//         const containerIds = Array.from(this.runningContainers.keys());
//         await Promise.all(containerIds.map(id => this.stopContainer(id).catch(err => 
//             logger.error(`Failed to stop container ${id} during cleanup`, { error: err.message })
//         )));
//     }

//     getRunningContainers() {
//         return Array.from(this.runningContainers.entries()).map(([containerId, info]) => ({
//             containerId: containerId.slice(0, 12),
//             taskId: info.taskId,
//             port: info.port,
//             scheduledStopTime: info.scheduledStopTime,
//             timeRemaining: Math.max(0, info.scheduledStopTime - new Date())
//         }));
//     }
// }

// module.exports = new GitHubDeployService();







const {exec} = require('child_process');
const {promisify} = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class GitHubDeployService {
    constructor() {
        this.runningContainers = new Map();
        this.usedPorts = new Set();
        this.basePort = 3000;
        this.maxPort = 4000;
        this.ec2PublicIp = process.env.EC2_PUBLIC_IP || 'localhost';
        this.cleanupInterval = this.startCleanupScheduler();
    }

    async getAvailablePort() {
        for (let port = this.basePort; port <= this.maxPort; port++) {
            if (!this.usedPorts.has(port)) {
                try {
                    const isAvailable = await this.isPortAvailable(port);
                    if (isAvailable) {
                        this.usedPorts.add(port);
                        logger.info(`Allocated port ${port}`);
                        return port;
                    }
                } catch (error) {
                    logger.warn(`Error checking port ${port}:`, error.message);
                    continue;
                }
            }
        }
        throw new Error('No available ports in range');
    }

    async isPortAvailable(port) {
        try {
            try {
                const { stdout: netstatOutput } = await execAsync(`netstat -tuln | grep :${port}`, { timeout: 5000 });
                if (netstatOutput.trim()) {
                    logger.debug(`Port ${port} is in use (netstat)`);
                    return false;
                }
            } catch (netstatError) {
            }

            try {
                const { stdout: ssOutput } = await execAsync(`ss -tuln | grep :${port}`, { timeout: 5000 });
                if (ssOutput.trim()) {
                    logger.debug(`Port ${port} is in use (ss)`);
                    return false;
                }
            } catch (ssError) {
            }

            try {
                const { stdout: dockerOutput } = await execAsync(`docker ps --format "table {{.Names}}\t{{.Ports}}" | grep ":${port}->"`, { timeout: 5000 });
                if (dockerOutput.trim()) {
                    logger.debug(`Port ${port} is in use by Docker container`);
                    return false;
                }
            } catch (dockerError) {
            }

            const net = require('net');
            return new Promise((resolve) => {
                const server = net.createServer();
                
                server.listen(port, '0.0.0.0', () => {
                    server.close(() => {
                        resolve(true);
                    });
                });
                
                server.on('error', (err) => {
                    resolve(false);
                });
                
                setTimeout(() => {
                    try {
                        server.close();
                    } catch (e) {}
                    resolve(false);
                }, 2000);
            });

        } catch (error) {
            logger.error(`Error checking port availability for ${port}:`, error.message);
            return false;
        }
    }

    releasePort(port) {
        this.usedPorts.delete(port);
        logger.info(`Released port ${port}`);
    }

    validateGitHubUrl(url) {
        const githubRegex = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/;
        return githubRegex.test(url);
    }

    async cloneRepository(githubUrl, taskId) {
        const cloneDir = path.join(process.cwd(), 'temp', taskId);
        try {
            await fs.mkdir(cloneDir, { recursive: true });
            await execAsync(`git clone ${githubUrl} ${cloneDir}`);
            const dockerfilePath = path.join(cloneDir, 'Dockerfile');
            await fs.access(dockerfilePath);
            return cloneDir;
        } catch (error) {
            try {
                await fs.rm(cloneDir, { recursive: true, force: true });
            } catch (cleanUpError) {
                logger.warn('Failed to cleanup clone directory', { error: cleanUpError.message });
            }
            throw new Error(`Failed to clone repository or Dockerfile not found: ${error.message}`);
        }
    }

    // async buildDockerImage(cloneDir, taskId) {
    //     const imageName = `github-deploy-${taskId}`.toLowerCase();
    //     try {
    //         const buildCommand = `docker build -t ${imageName} ${cloneDir}`;
    //         const { stdout, stderr } = await execAsync(buildCommand, {
    //             maxBuffer: 1024 * 1024 * 10,
    //             timeout: 600000
    //         });
            
    //         try {
    //             await execAsync(`docker images ${imageName} --format "{{.ID}}"`);
    //         } catch (imageCheckError) {
    //             throw new Error(`Docker image was not created successfully: ${imageCheckError.message}`);
    //         }
            
    //         logger.info(`Docker build completed for task ${taskId}`, {
    //             stdout: stdout.slice(-500),
    //             stderr: stderr.slice(-500)
    //         });
            
    //         return {
    //             imageName,
    //             buildLogs: stdout + stderr
    //         };
    //     } catch (error) {
    //         if (error.code && error.code !== 0) {
    //             const errorOutput = error.stderr || error.message || '';
    //             const isOnlyWarnings = errorOutput.includes('DEPRECATED') && 
    //                                  !errorOutput.includes('ERROR') && 
    //                                  !errorOutput.includes('failed') &&
    //                                  !errorOutput.includes('Error');
                
    //             if (!isOnlyWarnings) {
    //                 logger.error(`Docker build failed for task ${taskId}`, { 
    //                     error: error.message,
    //                     stderr: error.stderr,
    //                     stdout: error.stdout
    //                 });
    //                 throw new Error(`Docker build failed: ${error.message}`);
    //             } else {
    //                 try {
    //                     await execAsync(`docker images ${imageName} --format "{{.ID}}"`);
    //                     logger.info(`Docker build completed with warnings for task ${taskId}`);
    //                     return {
    //                         imageName,
    //                         buildLogs: (error.stdout || '') + (error.stderr || '')
    //                     };
    //                 } catch (imageCheckError) {
    //                     throw new Error(`Docker build failed: ${error.message}`);
    //                 }
    //             }
    //         } else {
    //             logger.error(`Docker build failed for task ${taskId}`, { error: error.message });
    //             throw new Error(`Docker build failed: ${error.message}`);
    //         }
    //     } finally {
    //         try {
    //             await fs.rm(cloneDir, { recursive: true, force: true });
    //         } catch (cleanUpError) {
    //             logger.warn('Failed to cleanup clone directory', { error: cleanUpError.message });
    //         }
    //     }
    // }

    // async runContainer(imageName, taskId, port) {
    //     const containerName = `github-deploy-${taskId}`;
    //     let containerId = null;
        
    //     try {
    //         const isStillAvailable = await this.isPortAvailable(port);
    //         if (!isStillAvailable) {
    //             this.releasePort(port);
    //             throw new Error(`Port ${port} became unavailable before container start`);
    //         }

    //         const runCommand = `docker run -d --name ${containerName} -p ${port}:3000 ${imageName}`;
    //         logger.info(`Running container with command: ${runCommand}`);
            
    //         const { stdout } = await execAsync(runCommand);
    //         containerId = stdout.trim();
            
    //         await new Promise(resolve => setTimeout(resolve, 2000));
            
    //         const { stdout: psOutput } = await execAsync(`docker ps --filter "id=${containerId}" --format "{{.Status}}"`);
    //         if (!psOutput.trim()) {
    //             throw new Error('Container failed to start');
    //         }
            
    //         const publicUrl = `http://${this.ec2PublicIp}:${port}`;
    //         const scheduledStopTime = new Date(Date.now() + 60 * 60 * 1000);
            
    //         this.runningContainers.set(containerId, {
    //             taskId,
    //             port,
    //             imageName,
    //             scheduledStopTime,
    //             containerName
    //         });
            
    //         logger.info(`Container started for task ${taskId}`, { 
    //             containerId: containerId.slice(0, 12), 
    //             publicUrl,
    //             scheduledStopTime 
    //         });
            
    //         return {
    //             containerId,
    //             publicUrl,
    //             scheduledStopTime
    //         };
    //     } catch (error) {
    //         this.releasePort(port);
            
    //         if (containerId) {
    //             try {
    //                 await execAsync(`docker stop ${containerId}`);
    //                 await execAsync(`docker rm ${containerId}`);
    //             } catch (cleanupError) {
    //                 logger.error(`Failed to cleanup failed container ${containerId}`, { error: cleanupError.message });
    //             }
    //         }
            
    //         if (error.message.includes('port is already allocated') || error.message.includes('bind failed')) {
    //             logger.warn(`Port allocation failed for ${port}, trying to find another port`);
    //             throw new Error(`Port ${port} allocation failed: ${error.message}`);
    //         }
            
    //         throw new Error(`Failed to run container: ${error.message}`);
    //     }
    // }
    

    async buildDockerImage(cloneDir, taskId) {
        const imageName = `gh-deploy-${taskId.slice(0, 8)}`.toLowerCase();
        
        try {
            const buildCommand = `docker build -t ${imageName} ${cloneDir}`;
            logger.info(`Building Docker image: ${buildCommand}`);
            
            const { stdout, stderr } = await execAsync(buildCommand, {
                maxBuffer: 1024 * 1024 * 10,
                timeout: 600000
            });
            
            // More thorough image verification
            let imageExists = false;
            try {
                const { stdout: imageId } = await execAsync(`docker images ${imageName} --format "{{.ID}}" | head -n1`);
                if (imageId.trim()) {
                    imageExists = true;
                    logger.info(`Docker image verified: ${imageName} (ID: ${imageId.trim()})`);
                }
            } catch (imageCheckError) {
                logger.error(`Image verification failed for ${imageName}`, { error: imageCheckError.message });
            }
            
            if (!imageExists) {
                try {
                    const { stdout: allImages } = await execAsync(`docker images | grep gh-deploy`);
                    logger.error(`Image not found. Available images:`, { allImages });
                } catch (listError) {
                    logger.error(`Could not list images`, { error: listError.message });
                }
                throw new Error(`Docker image ${imageName} was not created successfully`);
            }
            
            try {
                await execAsync(`docker inspect ${imageName}`);
            } catch (inspectError) {
                logger.error(`Image inspection failed for ${imageName}`, { error: inspectError.message });
                throw new Error(`Docker image ${imageName} exists but is corrupted or incomplete`);
            }
            
            logger.info(`Docker build completed successfully for task ${taskId}`, {
                imageName,
                stdout: stdout.slice(-500),
                stderr: stderr.slice(-500)
            });
            
            return {
                imageName,
                buildLogs: stdout + stderr
            };
            
        } catch (error) {
            if (error.code && error.code !== 0) {
                const errorOutput = error.stderr || error.message || '';
                const isOnlyWarnings = errorOutput.includes('DEPRECATED') && 
                                     !errorOutput.includes('ERROR') && 
                                     !errorOutput.includes('failed') &&
                                     !errorOutput.includes('Error') &&
                                     !errorOutput.includes('error:');
                
                if (!isOnlyWarnings) {
                    logger.error(`Docker build failed for task ${taskId}`, { 
                        error: error.message,
                        stderr: error.stderr,
                        stdout: error.stdout,
                        code: error.code
                    });
                    
                    try {
                        await execAsync(`docker rmi ${imageName} 2>/dev/null || true`);
                    } catch (cleanupError) {
                    }
                    
                    throw new Error(`Docker build failed: ${errorOutput || error.message}`);
                } else {
                    try {
                        const { stdout: imageId } = await execAsync(`docker images ${imageName} --format "{{.ID}}" | head -n1`);
                        if (!imageId.trim()) {
                            throw new Error(`Docker build completed with warnings but no image was created`);
                        }
                        logger.info(`Docker build completed with warnings for task ${taskId}`, { imageName });
                        return {
                            imageName,
                            buildLogs: (error.stdout || '') + (error.stderr || '')
                        };
                    } catch (imageCheckError) {
                        throw new Error(`Docker build failed: ${errorOutput || error.message}`);
                    }
                }
            } else {
                logger.error(`Docker build failed for task ${taskId}`, { 
                    error: error.message,
                    stack: error.stack
                });
                throw new Error(`Docker build failed: ${error.message}`);
            }
        } finally {
            try {
                await fs.rm(cloneDir, { recursive: true, force: true });
                logger.info(`Cleaned up clone directory for task ${taskId}`);
            } catch (cleanUpError) {
                logger.warn('Failed to cleanup clone directory', { 
                    cloneDir, 
                    error: cleanUpError.message 
                });
            }
        }
    }
    
    async runContainer(imageName, taskId, port) {
        const containerName = `gh-deploy-${taskId.slice(0, 8)}`;
        let containerId = null;
        
        try {
            try {
                await execAsync(`docker inspect ${imageName}`);
                logger.info(`Image ${imageName} verified before container run`);
            } catch (inspectError) {
                logger.error(`Image ${imageName} not found before container run`, { error: inspectError.message });
                throw new Error(`Docker image ${imageName} not found. Build may have failed.`);
            }
            
            const isStillAvailable = await this.isPortAvailable(port);
            if (!isStillAvailable) {
                this.releasePort(port);
                throw new Error(`Port ${port} became unavailable before container start`);
            }
    
            const runCommand = `docker run -d --name ${containerName} -p ${port}:3000 --network ${process.env.DOCKER_NETWORK || 'docklet_task-network'} ${imageName}`;
            logger.info(`Running container with command: ${runCommand}`);
            
            const { stdout, stderr } = await execAsync(runCommand);
            containerId = stdout.trim();
            
            if (!containerId) {
                throw new Error(`No container ID returned from docker run command. stderr: ${stderr}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const { stdout: psOutput } = await execAsync(`docker ps --filter "id=${containerId}" --format "{{.Status}}"`);
            if (!psOutput.trim()) {
                try {
                    const { stdout: logs } = await execAsync(`docker logs ${containerId}`);
                    logger.error(`Container failed to start. Logs:`, { logs });
                    throw new Error(`Container failed to start. Check logs: ${logs}`);
                } catch (logsError) {
                    throw new Error('Container failed to start and logs could not be retrieved');
                }
            }
            
            logger.info(`Container status: ${psOutput.trim()}`);
            
            const publicUrl = `http://${this.ec2PublicIp}:${port}`;
            const scheduledStopTime = new Date(Date.now() + 60 * 60 * 1000);
            
            this.runningContainers.set(containerId, {
                taskId,
                port,
                imageName,
                scheduledStopTime,
                containerName
            });
            
            logger.info(`Container started successfully for task ${taskId}`, { 
                containerId: containerId.slice(0, 12), 
                publicUrl,
                scheduledStopTime 
            });
            
            return {
                containerId,
                publicUrl,
                scheduledStopTime
            };
            
        } catch (error) {
            this.releasePort(port);
            
            if (containerId) {
                try {
                    await execAsync(`docker stop ${containerId}`);
                    await execAsync(`docker rm ${containerId}`);
                    logger.info(`Cleaned up failed container ${containerId.slice(0, 12)}`);
                } catch (cleanupError) {
                    logger.error(`Failed to cleanup failed container ${containerId}`, { error: cleanupError.message });
                }
            }
            
            if (error.message.includes('port is already allocated') || 
                error.message.includes('bind failed') || 
                error.message.includes('address already in use')) {
                logger.warn(`Port allocation failed for ${port}`, { error: error.message });
                throw new Error(`Port ${port} allocation failed: ${error.message}`);
            }
            
            if (error.message.includes('Unable to find image') || 
                error.message.includes('pull access denied')) {
                logger.error(`Image not found when running container`, { imageName, error: error.message });
                throw new Error(`Docker image ${imageName} not found. Build process may have failed.`);
            }
            
            throw new Error(`Failed to run container: ${error.message}`);
        }
    }
    async stopContainer(containerId) {
        try {
            const containerInfo = this.runningContainers.get(containerId);
            if (!containerInfo) {
                logger.warn(`Container ${containerId} not found in running containers`);
                return;
            }
            
            await execAsync(`docker stop ${containerId}`);
            await execAsync(`docker rm ${containerId}`);
            
            try {
                await execAsync(`docker rmi ${containerInfo.imageName}`);
            } catch (imageError) {
                logger.warn(`Failed to remove image ${containerInfo.imageName}`, { error: imageError.message });
            }
            
            this.releasePort(containerInfo.port);
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

    getPortStatus() {
        return {
            usedPorts: Array.from(this.usedPorts),
            runningContainers: this.getRunningContainers()
        };
    }
}

module.exports = new GitHubDeployService();