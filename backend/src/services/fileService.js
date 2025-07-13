const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const mime = require('mime-types');
const logger = require('../utils/logger.js');

class FileService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.outputDir = process.env.OUTPUT_DIR || './outputs';
    this.initializeDirectories();
  }

  async initializeDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.outputDir, { recursive: true });
      logger.info('File directories initialized');
    } catch (error) {
      logger.error('Failed to initialize directories:', error);
    }
  }

  async downloadFile(res, filePath, filename) {
    try {
      await fs.access(filePath);
      
      const stats = await fs.stat(filePath);
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      const fileStream = require('fs').createReadStream(filePath);
      fileStream.pipe(res);
      
      logger.info(`File downloaded: ${filename}`);
    } catch (error) {
      logger.error('Download failed:', error);
      
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'File not found' });
      } else {
        res.status(500).json({ error: 'Download failed' });
      }
    }
  }

  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.info(`File deleted: ${filePath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Failed to delete file ${filePath}:`, error);
      }
    }
  }

  async cleanupOldFiles(maxAge = 24 * 60 * 60 * 1000) { 
    try {
      const directories = [this.uploadDir, this.outputDir];
      const cutoff = Date.now() - maxAge;
      
      for (const dir of directories) {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoff) {
            await this.deleteFile(filePath);
          }
        }
      }
      
      logger.info('Old files cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }

  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const mimeType = mime.lookup(filePath);
      
      return {
        size: stats.size,
        mimeType,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      logger.error('Failed to get file info:', error);
      return null;
    }
  }

  async createZipArchive(files, outputPath) {
    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', () => {
        logger.info(`Archive created: ${outputPath} (${archive.pointer()} bytes)`);
        resolve();
      });
      
      archive.on('error', (err) => {
        logger.error('Archive creation failed:', err);
        reject(err);
      });
      
      archive.pipe(output);
      
      for (const file of files) {
        archive.file(file.path, { name: file.name });
      }
      
      archive.finalize();
    });
  }
}

module.exports = new FileService();