const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
        files: 1
    }
});

const validateFileType = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const allowedTypes = {
        'image-convert': [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
            'image/webp', 'image/bmp', 'image/tiff'
        ],
        'video-trim': [
            'video/mp4', 'video/avi', 'video/mov', 'video/mkv',
            'video/wmv', 'video/flv', 'video/webm'
        ]
    };

    const taskType = req.body.type; 
    const allowed = allowedTypes[taskType] || [];

    if (!allowed.includes(req.file.mimetype)) {
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting invalid file:', err);
        });
        
        return res.status(400).json({ 
            error: `File type ${req.file.mimetype} not allowed for task type ${taskType}` 
        });
    }

    next();
};

const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files' });
        }
        return res.status(400).json({ error: error.message });
    }
    
    if (error.message && error.message.includes('not allowed')) {
        return res.status(400).json({ error: error.message });
    }
    
    next(error);
};

module.exports = { upload, validateFileType, handleUploadError };