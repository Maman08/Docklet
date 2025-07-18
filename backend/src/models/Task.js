const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId,ref:'User', default: null },
    type: { type: String, required: true },
    status: { 
        type: String, 
        enum:['pending', 'processing', 'completed', 'failed', 'running', 'stopped'], 
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
    deploymentInfo:{
        githubUrl:String,
        publicUrl:String,
        containerId:String,
        port:Number,
        isRunning:Boolean,
        buildLogs:String,
        imageId:String,
        scheduledStopTime:Date
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