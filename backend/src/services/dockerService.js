const { docker } = require('../config/docker.js');
const logger = require('../utils/logger');
const fs = require('fs').promises;

class DockerService {
  constructor() {
    this.runningContainers = new Map();
  }

  async runContainer(config, timeout = 300000) {
    const containerId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let container = null;
    
    try {
      logger.info(`Starting container ${containerId} with image ${config.image}`);
      
      const containerConfig = {
        Image: config.image,
        name: containerId,
        Env: config.environment || [],
        HostConfig: {
          Binds: config.volumes || [],
          AutoRemove: false, // Changed to false to prevent premature removal
          NetworkMode: process.env.DOCKER_NETWORK || 'docklet_task-network'
        },
        AttachStdout: true,
        AttachStderr: true
      };

      container = await docker.createContainer(containerConfig);
      this.runningContainers.set(containerId, container);

      await container.start();
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Container ${containerId} timed out after ${timeout}ms`));
        }, timeout);
      });

      const waitPromise = container.wait();
      
      const result = await Promise.race([waitPromise, timeoutPromise]);
      
      let logsString = '';
      try {
        const logs = await container.logs({
          stdout: true,
          stderr: true,
          timestamps: true
        });
        logsString = logs.toString();
        logger.info(`Container ${containerId} logs:`, logsString);
      } catch (logError) {
        logger.warn(`Could not retrieve logs for container ${containerId}:`, logError.message);
        logsString = 'Logs unavailable';
      }

      logger.info(`Container ${containerId} completed with exit code: ${result.StatusCode}`);

      if (result.StatusCode !== 0) {
        throw new Error(`Container exited with code ${result.StatusCode}: ${logsString}`);
      }

      return { success: true, logs: logsString, exitCode: result.StatusCode };

    } catch (error) {
      logger.error(`Container ${containerId} failed:`, error);
      throw error;
    } finally {
      await this.cleanupContainer(containerId, container);
    }
  }

  async cleanupContainer(containerId, container = null) {
    try {
      if (!container) {
        container = this.runningContainers.get(containerId);
      }
      
      if (container) {
        try {
          await container.stop({ t: 10 }); 
        } catch (stopError) {
          logger.debug(`Could not stop container ${containerId}:`, stopError.message);
          
          try {
            await container.kill();
          } catch (killError) {
            logger.debug(`Could not kill container ${containerId}:`, killError.message);
          }
        }
        
        try {
          await container.remove({ force: true });
          logger.debug(`Removed container ${containerId}`);
        } catch (removeError) {
          logger.debug(`Could not remove container ${containerId}:`, removeError.message);
        }
      }
    } catch (error) {
      logger.warn(`Cleanup warning for container ${containerId}:`, error.message);
    } finally {
      this.runningContainers.delete(containerId);
    }
  }

  async buildImage(imageName, dockerfilePath, contextPath) {
    try {
      logger.info(`Building Docker image ${imageName}`);
      
      const stream = await docker.buildImage({
        context: contextPath,
        src: ['Dockerfile', '.']
      }, {
        t: imageName,
        dockerfile: 'Dockerfile'
      });

      return new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err, res) => {
          if (err) {
            logger.error(`Failed to build image ${imageName}:`, err);
            reject(err);
          } else {
            logger.info(`Successfully built image ${imageName}`);
            resolve(res);
          }
        }, (event) => {
          if (event.stream) {
            logger.debug(`Build ${imageName}: ${event.stream.trim()}`);
          }
        });
      });
    } catch (error) {
      logger.error(`Build failed for ${imageName}:`, error);
      throw error;
    }
  }

  async checkImageExists(imageName) {
    try {
      const image = docker.getImage(imageName);
      await image.inspect();
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async pullImage(imageName) {
    try {
      logger.info(`Pulling Docker image ${imageName}`);
      
      const stream = await docker.pull(imageName);
      
      return new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err, res) => {
          if (err) {
            logger.error(`Failed to pull image ${imageName}:`, err);
            reject(err);
          } else {
            logger.info(`Successfully pulled image ${imageName}`);
            resolve(res);
          }
        });
      });
    } catch (error) {
      logger.error(`Pull failed for ${imageName}:`, error);
      throw error;
    }
  }

  async cleanup() {
    logger.info('Cleaning up running containers...');
    
    for (const [containerId, container] of this.runningContainers) {
      await this.cleanupContainer(containerId, container);
    }
    
    this.runningContainers.clear();
  }
}

module.exports = new DockerService();