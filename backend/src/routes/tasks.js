const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const Task = require('../models/Task');
const logger = require('../utils/logger');
const { upload, validateFileType, handleUploadError } = require('../middleware/upload');
const { validateTask } = require('../middleware/validation');
const queueService = require('../services/queueService');
const fileService = require('../services/fileService');
const s3Service = require('../services/s3Service');
const githubDeployService = require('../services/githubDeployService');
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
        let s3Key = null;
        
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
            
            if (type !== 'github-deploy' && !file) {
                logger.warn('Missing file for file-based task');
                return res.status(400).json({ error: 'File is required for this task type' });
            }

            if (type === 'github-deploy') {
                if (!parameters || !parameters.githubUrl) {
                    return res.status(400).json({ error: 'GitHub URL is required for deploy task' });
                }
                
                const parsedParams = typeof parameters === 'string' ? JSON.parse(parameters) : parameters;
                if (!githubDeployService.validateGitHubUrl(parsedParams.githubUrl)) {
                    return res.status(400).json({ error: 'Invalid GitHub URL format' });
                }
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
            
            if (file) {
                s3Key = s3Service.generateUserUploadKey(req.user.id, file.originalname);
                try {
                    await s3Service.uploadFile(file.path, s3Key, file.mimetype);
                    logger.info('File uploaded to S3', { s3Key });
                } catch (s3Error) {
                    logger.error('S3 upload failed', { error: s3Error.message });
                    return res.status(500).json({ error: 'File upload to cloud storage failed' });
                }
            }

            const taskData = {
                id: taskId,
                userId: req.user ? req.user.id : null,
                type,
                parameters: parsedParams,
                status: 'pending'
            };

            if (file) {
                taskData.inputFile = {
                    originalName: file.originalname,
                    filename: file.filename,
                    path: file.path,
                    s3Key: s3Key,
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
            await task.save();
            
            logger.info('Task saved successfully to database', { taskId });
            
            await queueService.addTask(task.toObject());
            
            const processingTime = Date.now() - startTime;
            logger.info(`Task submitted successfully: ${taskId}`, { processingTime });
            
            const response = {
                message: 'Task submitted successfully', 
                taskId,
                estimatedTime: getEstimatedTime(type, file ? file.size : 0)
            };

            if (type === 'github-deploy') {
                response.message = 'GitHub deployment task submitted successfully';
                response.note = 'Your application will be available at a public URL once deployed';
                response.estimatedTime = '2-5 minutes';
            }
            
            res.status(201).json(response);
            
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

            if (s3Key) {
                try {
                    await s3Service.deleteFile(s3Key);
                    logger.info('Cleaned up S3 file after error', { s3Key });
                } catch (cleanupError) {
                    logger.error('Failed to cleanup S3 file', { s3Key, error: cleanupError.message });
                }
            }
            
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
            error: task.error
        };

        if (task.type === 'github-deploy') {
            response.deploymentInfo = task.deploymentInfo;
            if (task.deploymentInfo?.publicUrl) {
                response.publicUrl = task.deploymentInfo.publicUrl;
                response.scheduledStopTime = task.deploymentInfo.scheduledStopTime;
                response.timeRemaining = task.deploymentInfo.scheduledStopTime 
                    ? Math.max(0, new Date(task.deploymentInfo.scheduledStopTime) - new Date())
                    : null;
            }
        } else {
            response.downloadUrl = task.status === 'completed' && task.outputFile?.s3Key 
                ? `/api/tasks/download/${taskId}` 
                : null;
        }

        res.json(response);
    } catch (err) {
        logger.error('Task status error:', err);
        res.status(500).json({ error: 'Failed to get task status' });
    }
});

router.post('/stop/:taskId', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await Task.findOne({ id: taskId });
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (task.type !== 'github-deploy') {
            return res.status(400).json({ error: 'Only GitHub deploy tasks can be stopped' });
        }

        if (task.status !== 'running') {
            return res.status(400).json({ error: 'Task is not running' });
        }

        if (task.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to stop this task' });
        }

        if (task.deploymentInfo?.containerId) {
            await githubDeployService.stopContainer(task.deploymentInfo.containerId);
            
            await Task.findOneAndUpdate(
                { id: taskId },
                { 
                    status: 'stopped',
                    stoppedAt: new Date(),
                    'deploymentInfo.isRunning': false
                }
            );
            
            logger.info(`Task ${taskId} stopped by user ${req.user.id}`);
            res.json({ message: 'Deployment stopped successfully' });
        } else {
            return res.status(400).json({ error: 'No container information found' });
        }

    } catch (err) {
        logger.error('Stop task error:', err);
        res.status(500).json({ error: 'Failed to stop deployment' });
    }
});

router.get('/download/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await Task.findOne({ id: taskId });
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (task.type === 'github-deploy') {
            return res.status(400).json({ error: 'GitHub deploy tasks do not have downloadable files' });
        }

        if (task.status !== 'completed') {
            return res.status(400).json({ error: 'Task is not completed' });
        }

        if (!task.outputFile || !task.outputFile.s3Key) {
            return res.status(400).json({ error: 'No output file available' });
        }

        const presignedUrl = await s3Service.getPreSignedUrl(task.outputFile.s3Key, 3600);
        
        logger.info('Presigned URL generated for download', { 
            taskId, 
            userId: req.user?.id,
            s3Key: task.outputFile.s3Key 
        });

        res.json({
            downloadUrl: presignedUrl,
            filename: task.outputFile.filename || task.outputFile.originalName,
            size: task.outputFile.size,
            expiresIn: 3600 
        });

    } catch (err) {
        logger.error('Task download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

router.get('/profile/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const user = await User.findById(userId).select('username email');
        if (!user) {
            return res.status(404).json({ error: 'User Not Found' });
        }
        
        const tasks = await Task.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('-inputFile.path -outputFile.path'); 

        return res.status(200).json({
            user,
            tasks: tasks.map(task => {
                const taskObj = task.toObject();
                
                if (task.type === 'github-deploy') {
                    taskObj.publicUrl = task.deploymentInfo?.publicUrl || null;
                    taskObj.isRunning = task.status === 'running';
                    taskObj.timeRemaining = task.deploymentInfo?.scheduledStopTime 
                        ? Math.max(0, new Date(task.deploymentInfo.scheduledStopTime) - new Date())
                        : null;
                } else {
                    taskObj.downloadUrl = task.status === 'completed' && task.outputFile?.s3Key 
                        ? `/api/tasks/download/${task.id}` 
                        : null;
                }
                
                return taskObj;
            })
        });
    } catch (err) {
        logger.error('Profile fetch error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

router.get('/deployments/running', authenticateToken, async (req, res) => {
    try {
        const runningDeployments = await Task.find({ 
            type: 'github-deploy', 
            status: 'running',
            userId: req.user.id
        }).select('id deploymentInfo createdAt');

        res.json({
            deployments: runningDeployments.map(task => ({
                taskId: task.id,
                publicUrl: task.deploymentInfo?.publicUrl,
                scheduledStopTime: task.deploymentInfo?.scheduledStopTime,
                timeRemaining: task.deploymentInfo?.scheduledStopTime 
                    ? Math.max(0, new Date(task.deploymentInfo.scheduledStopTime) - new Date())
                    : null,
                createdAt: task.createdAt
            }))
        });
    } catch (err) {
        logger.error('Get running deployments error:', err);
        res.status(500).json({ error: 'Failed to get running deployments' });
    }
});

function getEstimatedTime(type, size) {
    const baseTimes = {
        'image-convert': 5,
        'video-trim': 30,
        'pdf-extract': 10,
        'csv-analyze': 15,
        'github-deploy': 180 // 3 minutes base time
    };
    
    let sizeMultiplier = 1;
    if (type !== 'github-deploy') {
        sizeMultiplier = Math.max(1, size / (10 * 1024 * 1024));
    }
    
    return Math.round((baseTimes[type] || 10) * sizeMultiplier);
}

module.exports = router;