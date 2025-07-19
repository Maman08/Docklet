const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const parseFileSize = (sizeStr) => {
    if (!sizeStr) return 100 * 1024 * 1024;
    const units = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024
    };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
    if (!match) {
        console.warn(`Invalid file size format: ${sizeStr}, using default 100MB`);
        return 100 * 1024 * 1024;
    }
    const [, size, unit] = match;
    const multiplier = units[unit.toUpperCase()] || 1;
    return Math.floor(parseFloat(size) * multiplier);
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const maxFileSize = parseFileSize(process.env.MAX_FILE_SIZE);
console.log(`Max file size configured: ${maxFileSize} bytes (${(maxFileSize / (1024 * 1024)).toFixed(2)} MB)`);

const upload = multer({
    storage,
    limits: {
        fileSize: maxFileSize,
        fieldSize: 10 * 1024 * 1024,
        files: 1
    }
});

const validateFileType = (req, res, next) => {
    // Skip file validation for github-deploy tasks
    if (req.body.type === 'github-deploy') {
        return next();
    }

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
        ],
        'pdf-extract': [
            'application/pdf'
        ],
        'csv-analyze': [
            'text/csv', 'application/csv', 'text/plain'
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
            return res.status(400).json({
                error: 'File size too large',
                maxSize: `${(maxFileSize / (1024 * 1024)).toFixed(2)} MB`
            });
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