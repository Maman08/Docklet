const crypto = require('crypto');
const path = require('path');

/**
 * Generate a secure random string
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Format file size in human readable format
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format duration in seconds to HH:MM:SS
 */
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return [hours, minutes, secs]
    .map(val => val.toString().padStart(2, '0'))
    .join(':');
};

/**
 * Parse time string (HH:MM:SS) to seconds
 */
const parseTimeToSeconds = (timeString) => {
  const parts = timeString.split(':').map(Number);
  if (parts.length !== 3) {
    throw new Error('Invalid time format. Expected HH:MM:SS');
  }
  
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * Validate file extension
 */
const isValidFileExtension = (filename, allowedExtensions) => {
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
};

/**
 * Sanitize filename for safe storage
 */
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
};

/**
 * Calculate estimated processing time based on file size and type
 */
const estimateProcessingTime = (taskType, fileSize) => {
  const baseTimes = {
    'image-convert': 2, // 2 seconds base
    'video-trim': 10    // 10 seconds base
  };
  
  const sizeMultiplier = Math.max(1, fileSize / (10 * 1024 * 1024)); // 10MB baseline
  const baseTime = baseTimes[taskType] || 5;
  
  return Math.round(baseTime * sizeMultiplier);
};

/**
 * Retry function with exponential backoff
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries - 1) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Deep clone object
 */
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if object is empty
 */
const isEmpty = (obj) => {
  return obj === null || obj === undefined || 
    (typeof obj === 'object' && Object.keys(obj).length === 0) ||
    (typeof obj === 'string' && obj.trim().length === 0);
};

/**
 * Throttle function execution
 */
const throttle = (func, delay) => {
  let timeoutId;
  let lastExecTime = 0;
  
  return function (...args) {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};

module.exports = {
  generateSecureToken,
  formatFileSize,
  formatDuration,
  parseTimeToSeconds,
  isValidFileExtension,
  sanitizeFilename,
  estimateProcessingTime,
  retryWithBackoff,
  deepClone,
  isEmpty,
  throttle
};