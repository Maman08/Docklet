const queueService=require('./queueService.js');
const dockerService =require('./dockerService.js');
const Task = require('../models/Task');
const logger = require('../utils/logger');
const {TASK_TYPES} = require('../utils/constants');
const path = require('path');

class TaskRunner{
    constructor(){
        this.isRunning = false;
        this.activeTasksCount = 0;
        this.maxConcurrentTasks = parseInt(process.env.MAX_CONCURRENT_TASKS) || 5;
        this.taskTimeout=parseInt(process.env.TASK_TIMEOUT)|| 300000;
        // Get the host paths for volume mounting
        this.hostUploadsPath = this.getHostPath('uploads');
        this.hostOutputsPath = this.getHostPath('outputs');
    }

   
getHostPath(directory) {
    // If running in Docker and environment variables are provided, use them
    if (process.env.RUNNING_IN_DOCKER) {
        if (directory === 'uploads' && process.env.HOST_UPLOADS_PATH) {
            return process.env.HOST_UPLOADS_PATH;
        }
        if (directory === 'outputs' && process.env.HOST_OUTPUTS_PATH) {
            return process.env.HOST_OUTPUTS_PATH;
        }
    }
    
    // Fallback to calculating paths
    if (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV || process.env.RUNNING_IN_DOCKER) {
        // In Docker environment, we need the host paths
        // Based on your setup, the backend folder is the project root
        return path.resolve('/app', '..', directory);
    } else {
        // For local development
        return path.resolve(process.cwd(), directory);
    }
}
    async start(){
        if(this.isRunning){
            logger.warn('TaskRunner is already running');
            return;
        }
        this.isRunning = true;
        logger.info('TaskRunner started');
        logger.info(`Host uploads path: ${this.hostUploadsPath}`);
        logger.info(`Host outputs path: ${this.hostOutputsPath}`);
        this.processLoop();
    }
    async stop(){
        if(!this.isRunning){
            logger.warn('TaskRunner is not running');
            return;
        }
        this.isRunning = false;
        logger.info('TaskRunner stopped');
    }
    async processLoop(){
        while(this.isRunning){
            try{
                if(this.activeTasksCount < this.maxConcurrentTasks){
                    const task=await queueService.getNextTask();
                    if(task){
                        this.processTask(task);
                    }else{
                        await this.sleep(1000); 
                    }
                }else{
                    await this.sleep(2000); 
                }
            }catch(err){
                logger.error('Error processing loop:', err);
                await this.sleep(5000); 
            }
        }
    }
    async processTask(task){
        this.activeTasksCount++;
        try{
            logger.info(`processing task: ${task.id} of type ${task.type}`);
            await Task.findOneAndUpdate(
                { id: task.id },
                { status: 'processing', startedAt: new Date() ,progress: 0 },
            );
            const startTime = Date.now();

            let result;
            switch(task.type) {
                case 'image-convert':
                    result=await this.processImageConversion(task);
                    break;
                case 'video-trim':
                    result=await this.processVideoTrim(task);
                    break;
                default:
                    throw new Error(`Unknown task type: ${task.type}`);    
            }
            const processingTime = Date.now() - startTime;
            await  Task.findOneAndUpdate(
                { id: task.id },
                {
                    status: 'completed',
                    outputFile: result.outputFile,
                    processingTime,
                    completedAt: new Date(),
                    progress: 100,
                }
            );
            logger.info(`Task ${task.id} completed successfully`);
        }catch(err){
            logger.error(`Error processing task ${task.id}:`, err);
            await Task.findOneAndUpdate(
                { id: task.id },
                {
                    status: 'failed',
                    error: err.message || 'Unknown error',
                    completedAt: new Date(),
                    progress: 0,
                }
            );
            }finally{
                this.activeTasksCount--;
                }

    }

    async processImageConversion(task) {
        const { inputFile, parameters } = task;
        
        const dockerConfig = {
          image: 'task-platform/image-processor:latest',
          volumes: [
            `${this.hostUploadsPath}:/input:ro`,   
            `${this.hostOutputsPath}:/output:rw`   
          ],
          environment: [
            `INPUT_FILE=/input/${inputFile.filename}`,
            `OUTPUT_FILE=/output/${task.id}_converted`,
            `FORMAT=${parameters.format || 'jpg'}`,
            `QUALITY=${parameters.quality || 80}`,
            `WIDTH=${parameters.width || ''}`,
            `HEIGHT=${parameters.height || ''}`
          ]
        };

        logger.info(`Volume mounts for image conversion: ${JSON.stringify(dockerConfig.volumes)}`);
        await dockerService.runContainer(dockerConfig, this.taskTimeout);
    
        return {
          outputFile: {
            filename: `${task.id}_converted.${parameters.format || 'jpg'}`,
            path: `${process.cwd()}/outputs/${task.id}_converted.${parameters.format || 'jpg'}`
          }
        };
      }
    
      async processVideoTrim(task) {
        const { inputFile, parameters } = task;
        
        const dockerConfig = {
          image: 'task-platform/video-processor:latest',
          volumes: [
            // Use the correct host paths that Docker can access
            `${this.hostUploadsPath}:/input:ro`,
            `${this.hostOutputsPath}:/output:rw`
          ],
          environment: [
            `INPUT_FILE=/input/${inputFile.filename}`,
            `OUTPUT_FILE=/output/${task.id}_trimmed.mp4`,
            `START_TIME=${parameters.startTime || '00:00:00'}`,
            `DURATION=${parameters.duration || ''}`,
            `END_TIME=${parameters.endTime || ''}`
          ]
        };

        logger.info(`Volume mounts for video trim: ${JSON.stringify(dockerConfig.volumes)}`);
        await dockerService.runContainer(dockerConfig, this.taskTimeout);
    
        return {
          outputFile: {
            filename: `${task.id}_trimmed.mp4`,
            path: `${process.cwd()}/outputs/${task.id}_trimmed.mp4`
          }
        };
      }
    
      sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
    }
    
    module.exports = new TaskRunner();