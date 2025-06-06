const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const logger = require('../utils/logger');
const {upload} = require('../middleware/upload');
const {validateTask} = require('../middleware/validateTask');
const queueService=require('../services/queueService');
const fileService = require('../services/fileService');
const {v4:uuidv4} = require('uuid');


router.post('/submit',upload.single('file'),validateTask,async (req, res) => {
    try{
        const {type,parameters} = req.body;
        const file = req.file;
        if(!file){
            return res.status(400).json({ error: 'File is required' });
        }
        const taskId = uuidv4();
        const parsedParams=typeof parameters === 'string' ? JSON.parse(parameters) : parameters;
        const task =new Task({
            id:taskId,
            userId: req.user ? req.user.id : null,
            type,
            inputFile:{
                originalName: file.originalname,
                filename: file.filename,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype
            },
            parameters: parsedParams
        });
        await task.save();
        await queueService.addTaskToQueue(task.toObject());
        logger.info(`Task submitted: ${taskId}`);
        res.status(201).json({ message: 'Task submitted successfully', taskId ,estimatedTime:getEstimatedTime(type,file.size) });
    }catch(err){
        logger.error('Task submission error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



router.get('/status/:taskId',async (req,res)=>{
    try{
        const{taskId}=req.params;
        const task=await Task.findOne({id:taskId});
        if(!task){
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({
            id:task.id,
            status:task.status,
            progress:task.progress,
            type:task.type,
            createdAt:task.createdAt,
            startedAt:task.startedAt,
            completedAt:task.completedAt,
            processingTime:task.processingTime,
            error:task.error,
        })
    }catch(err){
        logger.error('Task status error:', err);
        res.status(500).json({ error: 'Failed to get task status' });
    }
})

router.get('/download/:taskId',async(req,res)=>{
    try{
        const {taskId} = req.params;
        const task=Task.findOne({id:taskId});
        if(!task){
            return res.status(404).json({ error: 'Task not found' });
        }
        if(task.status !== 'completed'){
            return res.status(400).json({ error: 'Task is not completed' });
        }
        if(!task.outputFile || !task.outputFile.path){
            return res.status(400).json({ error: 'No output file available' });
        }
        await fileService.downloadFile(res, task.outputFile.path, task.outputFile.filename);
    }catch(err){
        logger.error('Task download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
    }
})

router.get('/my-tasks',async(req,res)=>{
    try{
        const userId=req.user?.id;
        if(!userId){
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const tasks=await Task.find({userId}).sort({createdAt:-1}).limit(50).select('-inputFile.path -outputFile.path');
        res.json({tasks});
    }catch(err){
        logger.error('My tasks error:', err);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
})


function getEstimatedTime(type,fileSize){
    const baseTimes={
        'image-converter': 5000, // seconds
        'video-trim': 30000 // seconds
    };
    const sizeMultiplier=Math.max(1,fileSize / (10*1024 * 1024)); 
    return Math.round((baseTimes[type]||10000) * sizeMultiplier);
}

module.exports = router;
