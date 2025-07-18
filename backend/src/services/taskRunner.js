const queueService = require('./queueService.js');
const dockerService = require('./dockerService.js');
const Task = require('../models/Task');
const logger = require('../utils/logger');
const { TASK_TYPES, DOCKER_IMAGES, PROCESSING_TIMEOUTS } = require('../utils/constants');
const path = require('path');
const fs = require('fs').promises;

class TaskRunner {
    constructor() {
        this.isRunning = false;
        this.activeTasksCount = 0;
        this.maxConcurrentTasks = parseInt(process.env.MAX_CONCURRENT_TASKS) || 5;
        this.taskTimeout = parseInt(process.env.TASK_TIMEOUT) || 300000;
        this.hostUploadsPath = this.getHostPath('uploads');
        this.hostOutputsPath = this.getHostPath('outputs');
        this.hostCodePath = this.getHostPath('code');
    }

    getHostPath(directory) {
        if (process.env.RUNNING_IN_DOCKER) {
            if (directory === 'uploads' && process.env.HOST_UPLOADS_PATH) {
                console.log('Returning: ENV HOST_UPLOADS_PATH');
                return process.env.HOST_UPLOADS_PATH;
            }
            if (directory === 'outputs' && process.env.HOST_OUTPUTS_PATH) {
                console.log('Returning: ENV HOST_OUTPUTS_PATH');
                return process.env.HOST_OUTPUTS_PATH;
            }
            if (directory === 'code' && process.env.HOST_CODE_PATH) {
                console.log('Returning: ENV HOST_CODE_PATH');
                return process.env.HOST_CODE_PATH;
            }
        }
    
        if (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV || process.env.RUNNING_IN_DOCKER) {
            const fallbackPath = path.resolve('/app', '..', directory);
            console.log('Returning: Docker fallback path =>', fallbackPath);
            return fallbackPath;
        }
    
        const localPath = path.resolve(process.cwd(), directory);
        console.log('Returning: Local dev path =>', localPath);
        return localPath;
    }
    
    async start() {
        if (this.isRunning) {
            logger.warn('TaskRunner is already running');
            return;
        }
        this.isRunning = true;
        logger.info('TaskRunner started');
        logger.info(`Host uploads path: ${this.hostUploadsPath}`);
        logger.info(`Host outputs path: ${this.hostOutputsPath}`);
        logger.info(`Host code path: ${this.hostCodePath}`);
        this.processLoop();
    }

    async stop() {
        if (!this.isRunning) {
            logger.warn('TaskRunner is not running');
            return;
        }
        this.isRunning = false;
        logger.info('TaskRunner stopped');
    }

    async processLoop() {
        while (this.isRunning) {
            try {
                if (this.activeTasksCount < this.maxConcurrentTasks) {
                    const task = await queueService.getNextTask();
                    if (task) {
                        this.processTask(task);
                    } else {
                        await this.sleep(1000);
                    }
                } else {
                    await this.sleep(2000);
                }
            } catch (err) {
                logger.error('Error processing loop:', err);
                await this.sleep(5000);
            }
        }
    }

async processTask(task) {
    this.activeTasksCount++;
    try {
        logger.info(`Processing task: ${task.id} of type ${task.type}`);
        await Task.findOneAndUpdate(
            { id: task.id },
            { status: 'processing', startedAt: new Date(), progress: 0 },
        );
        const startTime = Date.now();

        let result;
        switch (task.type) {
            case 'image-convert':
                result = await this.processImageConversion(task);
                break;
            case 'video-trim':
                result = await this.processVideoTrim(task);
                break;
            case 'pdf-extract':
                result = await this.processPdfExtraction(task);
                break;
            case 'csv-analyze':
                result = await this.processCsvAnalysis(task);
                break;
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }

        const processingTime = Date.now() - startTime;
        const updateData = {
            status: 'completed',
            processingTime,
            completedAt: new Date(),
            progress: 100,
        };

        if (result.outputFile) {
            updateData.outputFile = result.outputFile;
        }

        await Task.findOneAndUpdate({ id: task.id }, updateData);
        logger.info(`Task ${task.id} completed successfully`);
    } catch (err) {
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
    } finally {
        this.activeTasksCount--;
    }
}
    async processImageConversion(task) {
        const { inputFile, parameters } = task;
        
        const dockerConfig = {
            image: DOCKER_IMAGES['image-convert'],
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
        await dockerService.runContainer(dockerConfig, PROCESSING_TIMEOUTS['image-convert']);

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
            image: DOCKER_IMAGES['video-trim'],
            volumes: [
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
        await dockerService.runContainer(dockerConfig, PROCESSING_TIMEOUTS['video-trim']);

        return {
            outputFile: {
                filename: `${task.id}_trimmed.mp4`,
                path: `${process.cwd()}/outputs/${task.id}_trimmed.mp4`
            }
        };
    }

    async processPdfExtraction(task) {
        const { inputFile, parameters } = task;
        
        const dockerConfig = {
            image: DOCKER_IMAGES['pdf-extract'],
            volumes: [
                `${this.hostUploadsPath}:/input:ro`,
                `${this.hostOutputsPath}:/output:rw`
            ],
            environment: [
                `INPUT_FILE=/input/${inputFile.filename}`,
                `OUTPUT_FILE=/output/${task.id}_extracted`,
                `EXTRACT_IMAGES=${parameters.extractImages || false}`,
                `EXTRACT_TABLES=${parameters.extractTables || false}`,
                `OUTPUT_FORMAT=${parameters.outputFormat || 'text'}`,
                `PAGE_START=${parameters.pageRange?.start || ''}`,
                `PAGE_END=${parameters.pageRange?.end || ''}`
            ]
        };

        await dockerService.runContainer(dockerConfig, PROCESSING_TIMEOUTS['pdf-extract']);

        const outputExtension = parameters.outputFormat === 'json' ? '.json' : 
                               parameters.outputFormat === 'markdown' ? '.md' : '.txt';

        return {
            outputFile: {
                filename: `${task.id}_extracted${outputExtension}`,
                path: `${process.cwd()}/outputs/${task.id}_extracted${outputExtension}`
            }
        };
    }

    async processCsvAnalysis(task) {
        const { inputFile, parameters } = task;
        
        const dockerConfig = {
            image: DOCKER_IMAGES['csv-analyze'],
            volumes: [
                `${this.hostUploadsPath}:/input:ro`,
                `${this.hostOutputsPath}:/output:rw`
            ],
            environment: [
                `INPUT_FILE=/input/${inputFile.filename}`,
                `OUTPUT_FILE=/output/${task.id}_analysis`,
                `DELIMITER=${parameters.delimiter || ','}`,
                `HAS_HEADER=${parameters.hasHeader || true}`,
                `ANALYSIS_TYPE=${parameters.analysisType || 'basic'}`,
                `COLUMNS=${parameters.columns ? parameters.columns.join(',') : ''}`,
                `GENERATE_CHARTS=${parameters.generateCharts || false}`
            ]
        };

        await dockerService.runContainer(dockerConfig, PROCESSING_TIMEOUTS['csv-analyze']);

        return {
            outputFile: {
                filename: `${task.id}_analysis.json`,
                path: `${process.cwd()}/outputs/${task.id}_analysis.json`
            }
        };
    }


    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new TaskRunner();























