const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');
const queueService = require('../services/queueService');
const { docker } = require('../config/docker');
const logger = require('../utils/logger');

router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

router.get('/detailed', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {}
  };

  try {
    health.services.mongodb = {
      status: mongoose.connection.readyState === 1 ? 'UP' : 'DOWN',
      connected: mongoose.connection.readyState === 1
    };

    try {
      const redis = getRedisClient();
      await redis.ping();
      health.services.redis = { status: 'UP', connected: true };
    } catch (error) {
      health.services.redis = { status: 'DOWN', connected: false, error: error.message };
    }

    try {
      await docker.ping();
      health.services.docker = { status: 'UP', connected: true };
    } catch (error) {
      health.services.docker = { status: 'DOWN', connected: false, error: error.message };
    }

    try {
      const queueStats = await queueService.getQueueStats();
      health.services.queue = { 
        status: 'UP', 
        stats: queueStats 
      };
    } catch (error) {
      health.services.queue = { status: 'DOWN', error: error.message };
    }

    const allServicesUp = Object.values(health.services).every(
      service => service.status === 'UP'
    );
    health.status = allServicesUp ? 'OK' : 'DEGRADED';

    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

router.get('/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version
    },
    environment: process.env.NODE_ENV || 'development'
  };

  res.json(metrics);
});

module.exports = router;