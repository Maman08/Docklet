const AWS = require('aws-sdk')
const fs = require('fs').promises;
const path = require('path')
const logger =require('../utils/logger');

class S3Service{
    constructor(){
        this.s3 = new AWS.S3({
            accessKeyId:process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey:process.env.AWS_SECRET_KEY,
            region:process.env.AWS_REGION
        });
        this.bucketName=process.env.S3_BUCKET_NAME
        if(!this.bucketName){
            throw new Error('S3_BUCKET_NAME env var required')
        }
    }

    async uploadFile(filePath,key,contentType){
        try{
            const fileContent=await fs.readFile(filePath)
            const params={
                Bucket:this.bucketName,
                Key:key,
                Body:fileContent,
                ContentType:contentType,
                ServerSideEncryption:'AES256'
            };
            const result=await this.s3.upload(params).promise();
            logger.info('File Uploaded to S3',{key,location:result.Location})
            return result.Location
        }catch (error){
            logger.error('S3 upload error',{ error: error.message, key });
            throw error;
        }
    }

    async uploadOutputFile(filePath,key){
        try{
            const stats=await fs.stat(filePath); // It fetches details like file size, modification time etc
            const fileContent=await fs.readFile(filePath);
            const ext=path.extname(filePath).toLocaleLowerCase();//ir determine content type (MIME type) based on file extension
            const contentType=this.getContentType(ext)
            const params={
                Bucket:this.bucketName,
                Key:key,
                Body:fileContent,
                ContentType:contentType,
                ServerSideEncryption:'AES256'
            };
            const result=await this.s3.upload(params).promise();
            logger.info('Output Uploaded to S3',{key,location:result.Location})
            return {
                s3Key:key,
                s3Url:result.Location,
                filename:path.basename(filePath),// return only file name not complete path ,last / ke baad wala part return karta hai 
                size:stats.size,
                mimetype:contentType,
                uploadedAt:new Date()
            };
        }catch (error) {
            logger.error('S3 output upload error', { error: error.message, key, filePath });
            throw error;
        }
    }

    getContentType(ext) {
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.wmv': 'video/x-ms-wmv',
            '.webm': 'video/webm',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.xml': 'application/xml',
            '.md': 'text/markdown',
            '.html': 'text/html',
            '.zip': 'application/zip',
            '.tar': 'application/x-tar',
            '.gz': 'application/gzip'
        };
        
        return contentTypes[ext] || 'application/octet-stream';
    }

    async getPreSignedUrl(key,expiresIn=3600){
        try{
            const params={
                Bucket:this.bucketName,
                Key:key,
                Expires:expiresIn,
                ResponseContentDisposition:'attachment'// If the file is a PDF, image, or text file, then browser might open it directly in a new tab but With 'attachment' the browser automatically downloads the file
            };
            const url = await this.s3.getSignedUrlPromise('getObject',params);
            logger.info('Presigned URL generated', { key, expiresIn });
            return url;
        }catch (error) {
            logger.error('Presigned URL generation error', { error: error.message, key });
            throw error;
        }
    }
    // utility function bnaa de rhe baad me kaam aa sktaa hia for cleanup expired or failed tasks
    async deleteFile(key){
        try{
            const params={
                Bucket:this.bucketName,
                Key:key
            };
            await this.s3.deleteObject(params).promise();
            logger.info('File deleted from S3', { key });
        }catch (error) {
            logger.error('S3 delete error', { error: error.message, key });
            throw error;
        }
    }

    //before generating presigned URL verify file exists
    async fileExists(key){
        try{
            const params={
                Bucket:this.bucketName,
                Key:key
            };
            await this.s3.headObject(params).promise();
            return true;
        }catch (error) {
            if (error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    generateTaskOutputKey(taskId, filename) {
        const timestamp = new Date().toISOString().split('T')[0];
        return `task-outputs/${timestamp}/${taskId}/${filename}`;
    }
    generateUserUploadKey(userId, filename) {
        const timestamp = Date.now();
        return `user-uploads/${userId}/${timestamp}_${filename}`;
    } 
    async cleanupLocalFile(filePath) {
        try {
            await fs.unlink(filePath);
            logger.info('Local file cleaned up', { filePath });
        } catch (error) {
            logger.warn('Failed to cleanup local file', { filePath, error: error.message });
        }
    }
}

module.exports=new S3Service();