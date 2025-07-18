const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId,ref:'User', default: null },
    type: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'processing', 'completed', 'failed'], 
        default: 'pending' 
    },
    progress: { type: Number, default: 0 },
    
    inputFile: {
        originalName: String,
        filename: String,
        path: String,
        size: Number,
        mimetype: String
    },
    outputFile: {
        filename: String,
        originalName: String,
        path: String,
        s3Key: String,
        size:Number,
        mimetype:String
    },
    
    parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: String,
    processingTime: Number,
    
    createdAt: { type: Date, default: Date.now },
    startedAt: Date,
    completedAt: Date,
}, {
    timestamps: true
});

module.exports = mongoose.model('Task', TaskSchema);