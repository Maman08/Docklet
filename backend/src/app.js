const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const {connectDB} = require('./config/database');
const {connectRedis} = require('./config/redis');


const logger = require('./utils/logger');



const authRoutes = require('./routes/authRoutes');  
const taskRoutes = require('./routes/taskRoutes');

const taskRunner = require('./services/taskRunner.js');


const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

app.use((err,req,res,next)=>{
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
})

app.use('*',(req,res)=>{
    res.status(404).json({ error: 'Not Found' });
})

const PORT = process.env.PORT || 3000;

const startServer=async()=>{
    try{
        await connectDB();
        await connectRedis();
        taskRunner.start();
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);

        });
    }catch(err){
        logger.error('Error starting server:', err);
        process.exit(1);
    }
}
startServer();
module.exports = app;