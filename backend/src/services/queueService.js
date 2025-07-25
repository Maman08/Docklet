const {getRedisClient}= require('../config/redis');
const logger = require('../utils/logger');

const QUEUE_KEY = 'task:queue';
const PROCESSING_KEY ='task:processing';

class queueService{
    constructor(){
        this.redis=null;
    }
    async initialize(){
        this.redis=getRedisClient();
    }
    async addTask(task){
        try{
            if(!this.redis){
                await this.initialize();
            }
            const taskData=JSON.stringify(task);
            await this.redis.rPush(QUEUE_KEY, taskData);
            logger.info(`Task added to queue: ${task.id}`);
            return true;
        }catch(err){
            logger.error('Error adding task to queue:', err);
            return false;
        }
    }

    async getNextTask(){
        try{
            if(!this.redis){
                await this.initialize();
            }
            //BLMOVE atomically moves an element from a source list to a destination list, with blocking support
            //When we talk about "blocking support" in the context of Redis commands like BLMOVE, it means that the client (the program or application sending the command) will pause its execution and wait if the requested operation cannot be completed immediately
            //Yeh ensure karta hai ki ek hi task ek baar pick ho aur koi race condition na ho
            //BLMOVE ek atomic Redis command hai:
            // LEFT (from) queue se ek task uthao
            // RIGHT (to) processing list me daal do
            // agar queue empty hai, 1 second tak wait karo
            // Ye background runner (taskRunner.js) isse repeatedly call karta hai
            const taskData = await this.redis.BLMOVE(QUEUE_KEY,PROCESSING_KEY, 'LEFT', 'RIGHT', 1);
            if(!taskData){
                return null;
            }
            const task=JSON.parse(taskData);
            logger.info(`Retrieved task from queue: ${task.id}`);
            return task;
        }catch(err){
            logger.error('Error retrieving task from queue:', err);
            return null;
        }
    }

    async completeTask(taskId){
        try{
            if(!this.redis){
                await this.initialize();
            }
            const processingTasks=await this.redis.lRange(PROCESSING_KEY, 0, -1);

            for(let i=0;i<processingTasks.length;i++){
                const task=JSON.parse(processingTasks[i]);
                if(task.id === taskId){
                    await this.redis.lRem(PROCESSING_KEY, 1, JSON.stringify(task));
                    logger.info(`Task completed and removed from processing: ${taskId}`);
                    break;
                }
            }
        }catch(err){
            logger.error('Error completing task:', err);
        }
    }

    async getQueueStats(){
        try{
            if(!this.redis){
                await this.initialize();
            }
            const queueLength = await this.redis.llen(QUEUE_KEY);
            const processingLength = await this.redis.llen(PROCESSING_KEY);
            return {
                queueLength,
                processingLength
            };
        }catch(err) {
            logger.error('Error getting queue stats:', err);
            return {pending: 0, processing: 0,timestamp: new Date().toISOString() };
        }
    }
    async clearQueue(){
        try{
            if(!this.redis){
                await this.initialize();
            }
            await this.redis.del(QUEUE_KEY);
            await this.redis.del(PROCESSING_KEY);
            logger.info('Queue cleared');
        }catch(err){
            logger.error('Error clearing queue:', err);
        }
    }
}


module.exports = new queueService();