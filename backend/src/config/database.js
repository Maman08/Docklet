const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB=async()=>{
    try{
        const conn=await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/docklet')
        logger.info(`MongoDB connected: ${conn.connection.host}`);
    }catch(err){
        logger.error('MongoDB connection error:', err);
        process.exit(1);
    }
    
}

module.exports = { connectDB };