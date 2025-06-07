const TASK_TYPES = {
    IMAGE_CONVERT: 'image-convert',
    VIDEO_TRIM: 'video-trim'
  };
  
  const TASK_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
  };
  
  const SUPPORTED_IMAGE_FORMATS = {
    INPUT: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'],
    OUTPUT: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
  };
  
  const SUPPORTED_VIDEO_FORMATS = {
    INPUT: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'],
    OUTPUT: ['mp4', 'avi', 'mov', 'mkv']
  };
  
  const DOCKER_IMAGES = {
    IMAGE_PROCESSOR: 'task-platform/image-processor:latest',
    VIDEO_PROCESSOR: 'task-platform/video-processor:latest'
  };
  
  const ERROR_MESSAGES = {
    FILE_NOT_FOUND: 'File not found',
    INVALID_FILE_TYPE: 'Invalid file type',
    FILE_TOO_LARGE: 'File size exceeds limit',
    TASK_NOT_FOUND: 'Task not found',
    PROCESSING_FAILED: 'Processing failed',
    INVALID_PARAMETERS: 'Invalid parameters',
    AUTHENTICATION_REQUIRED: 'Authentication required',
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions'
  };
  
  const FILE_SIZE_LIMITS = {
    IMAGE: 50 * 1024 * 1024,  // 50MB
    VIDEO: 500 * 1024 * 1024  // 500MB
  };
  
  const PROCESSING_TIMEOUTS = {
    IMAGE_CONVERT: 5 * 60 * 1000,   // 5 minutes
    VIDEO_TRIM: 30 * 60 * 1000      // 30 minutes
  };
  
  const QUEUE_PRIORITIES = {
    LOW: 1,
    NORMAL: 2,
    HIGH: 3,
    URGENT: 4
  };
  
  module.exports = {
    TASK_TYPES,
    TASK_STATUS,
    SUPPORTED_IMAGE_FORMATS,
    SUPPORTED_VIDEO_FORMATS,
    DOCKER_IMAGES,
    ERROR_MESSAGES,
    FILE_SIZE_LIMITS,
    PROCESSING_TIMEOUTS,
    QUEUE_PRIORITIES
  };