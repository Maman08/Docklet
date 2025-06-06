const queueService=require('./queueService');
const dockerService =require('./dockerService');
const Task = require('../models/Task');
const logger = require('../utils/logger');
const {TASK_TYPES} = require('../utils/constants');

class TaskRunner{
    constructor(){
        this.isRunning = false;
        this.activeTasksCount = 0;
        this.maxConcurrentTasks = parseInt(process.env.MAX_CONCURRENT_TASKS) || 5;
        this.taskTimeout=parseInt(process.env.TASK_TIMEOUT)|| 300000;
    }
    async start(){
        if(this.isRunning){
            logger.warn('TaskRunner is already running');
            return;
        }
        this.isRunning = true;
        logger.info('TaskRunner started');
        this.processQueue();
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

    
        
        
}