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


router.post('/submit', 
    upload.single('file'), 
    validateTask, 
    validateFileType, 
    handleUploadError, 
    async (req, res) => {
        try {
            const { type, parameters } = req.body;
            const file = req.file;
            
            if (!file) {
                return res.status(400).json({ error: 'File is required' });
            }

            try {
                await fs.access(file.path);
                logger.info(`File uploaded successfully: ${file.path}`);
            } catch (accessError) {
                logger.error(`File access error after upload: ${file.path}`, accessError);
                return res.status(500).json({ error: 'File upload failed - access denied' });
            }

            const taskId = uuidv4();
            const parsedParams = typeof parameters === 'string' ? JSON.parse(parameters) : parameters;
            
            const task = new Task({
                id: taskId,
                userId: req.user ? req.user.id : null,
                type,
                inputFile: {
                    originalName: file.originalname,
                    filename: file.filename,
                    path: file.path,
                    size: file.size,
                    mimetype: file.mimetype
                },
                parameters: parsedParams
            });

            await task.save();
            await queueService.addTask(task.toObject());
            
            logger.info(`Task submitted: ${taskId}`);
            res.status(201).json({ 
                message: 'Task submitted successfully', 
                taskId,
                estimatedTime: getEstimatedTime(type, file.size)
            });
        } catch (err) {
            logger.error('Task submission error:', err);
            
            if (req.file && req.file.path) {
                try {
                    await fs.unlink(req.file.path);
                    logger.info(`Cleaned up file after error: ${req.file.path}`);
                } catch (unlinkErr) {
                    logger.error('Error deleting file after task creation failure:', unlinkErr);
                }
            }
            
            res.status(500).json({ error: 'Internal Server Error' });
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

        res.json({
            id: task.id,
            status: task.status,
            progress: task.progress,
            type: task.type,
            createdAt: task.createdAt,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            processingTime: task.processingTime,
            error: task.error,
        });
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

router.get('/my-tasks', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const tasks = await Task.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('-inputFile.path -outputFile.path');
            
        res.json({ tasks });
    } catch (err) {
        logger.error('My tasks error:', err);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

function getEstimatedTime(type, fileSize) {
    const baseTimes = {
        'image-convert': 5, // 5 seconds
        'video-trim': 30 // 30 seconds
    };
    
    const sizeMultiplier = Math.max(1, fileSize / (10 * 1024 * 1024));
    return Math.round((baseTimes[type] || 10) * sizeMultiplier);
}

module.exports = router;