const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const healthRoutes = require('./routes/health');
const taskRunner = require('./services/taskRunner.js');

const app = express();

app.use(cors({
    origin: ['https://docklet.vercel.app'],
    credentials: true
}));
app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/health', healthRoutes);

app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route Not Found' });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await connectDB();
        await connectRedis();
        taskRunner.start();
        
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (err) {
        logger.error('Error starting server:', err);
        process.exit(1);
    }
};

startServer();

module.exports = app;