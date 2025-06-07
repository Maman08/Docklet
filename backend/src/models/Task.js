const mongoose = require('mongoose');
const { param } = require('../app');

const taskSchema=new mongoose.Schema({
    id:{
        type:String,
        required:true,
        unique:true
    },
    userId:{
        type:String,
        default:null
    },
    type:{
        type:String,
        required:true,
        enum:['image-convert','video-trim']
    },
    status:{
        type:String,
        enum:['pending','processing','completed','failed'],
        default:'pending'
    },
    inputFile:{
        originalName: String,
        filename:String,
        path:String,
        size:Number,
        mimetype:String
    },
    outputFile:{
        filename:String,
        path:String,
        size:Number,
    },
    parameters:{
        type:mongoose.Schema.Types.Mixed,
        default:{}
    },
    progress:{
        type:Number,
        default:0
    },
    processingTime:{
        type:Number,
        default:0
    },
    error:{
        type:String,
        default:null
    },
    startedAt:{
        type:Date,
        default:null
    },

    createdAt:{
        type:Date,
        default:Date.now
    },
    completedAt:{
        type:Date,
        default:null
    }
});

taskSchema.index({ userId: 1, status: 1, createdAt: -1 });
taskSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Task', taskSchema);