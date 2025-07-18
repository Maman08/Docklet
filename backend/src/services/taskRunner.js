const queueService = require('./queueService.js');
const dockerService = require('./dockerService.js');
const s3Service =require('./s3Service.js')
const githubDeployService = require('./githubDeployService.js');
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
    let outputFilePath = null;
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
            case 'github-deploy':
                result=await this.processGithubDeploy(task);
                break;    
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }

        const processingTime = Date.now() - startTime;

        if(task.type==='github-deploy'){
            // For GitHub deploy, we don't upload to S3, we just store deployment info
            const updateData={
                status:'running',
                processingTime,
                createdAt:Date.now(),
                progress:100,
                deploymentInfo:{
                    githubUrl:task.parameters.githubUrl,
                    publicUrl: result.publicUrl,
                    containerId: result.containerId,
                    port: result.port,
                    imageId: result.imageName,
                    scheduledStopTime: result.scheduledStopTime,
                    isRunning: true,
                    buildLogs: result.buildLogs
                }
            };
            await Task.findOneAndUpdate({id:task.id},updateData);
            logger.info(`GitHub deploy task ${task.id} completed successfully`, { 
                publicUrl: result.publicUrl,
                scheduledStopTime: result.scheduledStopTime 
            }); 
        }else{
            outputFilePath=result.outputFile.path;
            
            logger.info(`Uploading output file to S3: ${outputFilePath}`);
            const s3Key = s3Service.generateTaskOutputKey(task.id, result.outputFile.filename);
            const s3FileInfo = await s3Service.uploadOutputFile(outputFilePath, s3Key);
            const updateData = {
                status: 'completed',
                processingTime,
                completedAt: new Date(),
                progress: 100,
                outputFile: {
                    filename: result.outputFile.filename,
                    originalName: result.outputFile.filename,
                    path: result.outputFile.path, //local path for reference
                    s3Key: s3FileInfo.s3Key,
                    size: s3FileInfo.size,
                    mimetype: s3FileInfo.mimetype
                }
            };
            await Task.findOneAndUpdate({ id: task.id }, updateData);
            logger.info(`Task ${task.id} completed successfully and uploaded to S3`, { s3Key: s3FileInfo.s3Key });
            await s3Service.cleanupLocalFile(outputFilePath);
        }
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
        if (outputFilePath) {
            await s3Service.cleanupLocalFile(outputFilePath);
        }
    } finally {
        this.activeTasksCount--;
    }
}

    
    async processGithubDeploy(task){
        const {parameters}=task;
        const {githubUrl}=parameters;
        if (!githubDeployService.validateGitHubUrl(githubUrl)) {
            throw new Error('Invalid GitHub URL format');
        }
        await Task.findOneAndUpdate({id:task.id},{progress:10});
        logger.info(`Cloning repository for task ${task.id}`, { githubUrl });
        const cloneDir = await githubDeployService.cloneRepository(githubUrl, task.id);
        await Task.findOneAndUpdate({ id: task.id },{ progress: 30 });
        logger.info(`Building Docker image for task ${task.id}`);
        const { imageName, buildLogs } = await githubDeployService.buildDockerImage(cloneDir, task.id);
        await Task.findOneAndUpdate({ id: task.id },{ progress: 70 });
        const port = await githubDeployService.getAvailablePort();
        logger.info(`Running container for task ${task.id}`, { port });
        const { containerId, publicUrl, scheduledStopTime } = await githubDeployService.runContainer(imageName, task.id, port);
        await Task.findOneAndUpdate({ id: task.id },{ progress: 100 });
        return {publicUrl,containerId,port,imageName,scheduledStopTime,buildLogs};
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
        const outputFilename = `${task.id}_converted.${parameters.format || 'jpg'}`;
        const outputPath = `${process.cwd()}/outputs/${outputFilename}`;
        try {
            await fs.access(outputPath);
        } catch (error) {
            throw new Error(`Output file not found: ${outputPath}`);
        }

        return {
            outputFile: {
                filename: outputFilename,
                path: outputPath
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
        const outputFilename = `${task.id}_trimmed.mp4`;
        const outputPath = `${process.cwd()}/outputs/${outputFilename}`;
        try {
            await fs.access(outputPath);
        } catch (error) {
            throw new Error(`Output file not found: ${outputPath}`);
        }
        return {
            outputFile: {
                filename: outputFilename,
                path:outputPath
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

        const outputFilename = `${task.id}_extracted${outputExtension}`;
        const outputPath = `${process.cwd()}/outputs/${outputFilename}`;
        try {
            await fs.access(outputPath);
        } catch (error) {
            throw new Error(`Output file not found: ${outputPath}`);
        }                       

        return {
            outputFile: {
                filename:outputFilename,
                path:outputPath
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
        const outputFilename = `${task.id}_analysis.json`;
        const outputPath = `${process.cwd()}/outputs/${outputFilename}`;
        try {
            await fs.access(outputPath);
        } catch (error) {
            throw new Error(`Output file not found: ${outputPath}`);
        }

        return {
            outputFile: {
                filename: outputFilename,
                path:outputPath
            }
        };
    }


    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new TaskRunner();

