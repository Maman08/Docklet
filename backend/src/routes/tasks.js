const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const Task = require('../models/Task');
const logger = require('../utils/logger');
const { upload, validateFileType, handleUploadError } = require('../middleware/upload');
const { validateTask } = require('../middleware/validation');
const queueService = require('../services/queueService');
const fileService = require('../services/fileService');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { error } = require('console');
const User = require('../models/User');

router.post('/submit', 
    authenticateToken,
    upload.single('file'), 
    validateTask, 
    handleUploadError, 
    async (req, res) => {
        const startTime = Date.now();
        let taskId = null;
        
        try {
            logger.info('=== TASK SUBMISSION START ===', {
                headers: req.headers,
                contentType: req.get('content-type'),
                contentLength: req.get('content-length'),
                bodySize: JSON.stringify(req.body).length,
                fileInfo: req.file ? {
                    originalname: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                    path: req.file.path
                } : 'No file'
            });

            const { type, parameters } = req.body;
            const file = req.file;
            
            if (!file) {
                logger.warn('Missing file');
                return res.status(400).json({ error: 'File is required' });
            }

            if (file) {
                try {
                    await fs.access(file.path);
                    logger.info(`File uploaded successfully: ${file.path}, size: ${file.size} bytes`);
                } catch (accessError) {
                    logger.error(`File access error after upload: ${file.path}`, {
                        error: accessError.message,
                        code: accessError.code,
                        errno: accessError.errno
                    });
                    return res.status(500).json({ error: 'File upload failed - access denied' });
                }
            }

            taskId = uuidv4();
            let parsedParams;
            
            try {
                parsedParams = typeof parameters === 'string' ? JSON.parse(parameters) : parameters;
                logger.info('Parameters parsed successfully', { parsedParams });
            } catch (parseError) {
                logger.error('Parameter parsing error', { 
                    parameters, 
                    error: parseError.message 
                });
                return res.status(400).json({ error: 'Invalid parameters format' });
            }
            
            const taskData = {
                id: taskId,
                userId: req.user ? req.user.id : null,
                type,
                parameters: parsedParams
            };

            if (file) {
                taskData.inputFile = {
                    originalName: file.originalname,
                    filename: file.filename,
                    path: file.path,
                    size: file.size,
                    mimetype: file.mimetype
                };
                logger.info('File info added to task data', { fileInfo: taskData.inputFile });
            }
            logger.info('Creating task in database', { 
                taskDataSize: JSON.stringify(taskData).length,
                taskId 
            });

            const task = new Task(taskData);
            
            logger.info('Task object created, attempting to save...', { taskId });
            
            await task.save();
            
            logger.info('Task saved successfully to database', { taskId });
            
            await queueService.addTask(task.toObject());
            
            const processingTime = Date.now() - startTime;
            logger.info(`Task submitted successfully: ${taskId}`, { processingTime });
            
            res.status(201).json({ 
                message: 'Task submitted successfully', 
                taskId,
                estimatedTime: getEstimatedTime(type, file ? file.size : code ? code.length : 0)
            });
            
        } catch (err) {
            const processingTime = Date.now() - startTime;
            
            logger.error('=== TASK SUBMISSION ERROR ===', {
                taskId,
                processingTime,
                errorMessage: err.message,
                errorStack: err.stack,
                errorName: err.name,
                errorCode: err.code,
                mongoError: err.name === 'MongoError' ? {
                    keyPattern: err.keyPattern,
                    keyValue: err.keyValue
                } : null,
                requestInfo: {
                    bodySize: JSON.stringify(req.body).length,
                    fileSize: req.file ? req.file.size : 0,
                    hasFile: !!req.file,
                }
            });
            
            if (req.file && req.file.path) {
                try {
                    await fs.unlink(req.file.path);
                    logger.info(`Cleaned up file after error: ${req.file.path}`);
                } catch (unlinkErr) {
                    logger.error('Error deleting file after task creation failure:', unlinkErr);
                }
            }
            
            if (err.name === 'ValidationError') {
                return res.status(400).json({ 
                    error: 'Validation Error', 
                    details: err.message,
                    taskId 
                });
            }
            
            if (err.name === 'MongoError' || err.name === 'MongoServerError') {
                return res.status(500).json({ 
                    error: 'Database Error', 
                    details: err.message,
                    code: err.code,
                    taskId 
                });
            }
            
            res.status(500).json({ 
                error: 'Internal Server Error',
                taskId,
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    }
);

router.get('/status/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await Task.findOne({ id: taskId });
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const response = {
            id: task.id,
            status: task.status,
            progress: task.progress,
            type: task.type,
            createdAt: task.createdAt,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            processingTime: task.processingTime,
            error: task.error,
        };

        res.json(response);
    } catch (err) {
        logger.error('Task status error:', err);
        res.status(500).json({ error: 'Failed to get task status' });
    }
});

router.get('/download/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await Task.findOne({ id: taskId });
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (task.status !== 'completed') {
            return res.status(400).json({ error: 'Task is not completed' });
        }

        if (!task.outputFile || !task.outputFile.path) {
            return res.status(400).json({ error: 'No output file available' });
        }

        await fileService.downloadFile(res, task.outputFile.path, task.outputFile.filename);
    } catch (err) {
        logger.error('Task download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// router.get('/my-tasks', authenticateToken, async (req, res) => {
//     try {
//         const userId = req.user?.id;
//         if (!userId) {
//             return res.status(401).json({ error: 'Unauthorized' });
//         }

//         const tasks = await Task.find({ userId })
//             .sort({ createdAt: -1 })
//             .limit(50)
//             .select('-inputFile.path -outputFile.path -codeContent');
            
//         res.json({ tasks });
//     } catch (err) {
//         logger.error('My tasks error:', err);
//         res.status(500).json({ error: 'Failed to fetch tasks' });
//     }
// });

router.get('/profile/:userId',authenticateToken,async(req,res)=>{
    try{
        const userId=req.params.userId;
        if(!userId){
            return res.status(401).json({error:'Unauthorized'});
        }
        const user=await User.findById(userId).select('username email')
        if(!user){
            return res.status(404).json({error:'User Not Found'});
        }
        const task= await Task.find({userId})
        return res.status(200).json({
            user,tasks: task
        })
    }catch(err){
        return res.status(500).json({ error: 'Server error' });
    }
})

function getEstimatedTime(type, size) {
    const baseTimes = {
        'image-convert': 5,
        'video-trim': 30,
        'pdf-extract': 10,
        'csv-analyze': 15
    };
    
    let sizeMultiplier = 1;
    sizeMultiplier = Math.max(1, size / (10 * 1024 * 1024));
    
    
    return Math.round((baseTimes[type] || 10) * sizeMultiplier);
}

module.exports = router;