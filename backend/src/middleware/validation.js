const Joi = require('joi');
const logger = require('../utils/logger');
const { FORBIDDEN_CODE_PATTERNS } = require('../utils/constants');

const taskSchema = Joi.object({
  type: Joi.string().valid(
    'image-convert', 
    'video-trim',
    'pdf-extract',
    'csv-analyze'
  ).required(),
  parameters: Joi.alternatives().try(
    Joi.string(),
    Joi.object()
  ).required()
});

const imageConvertParams = Joi.object({
  format: Joi.string().valid('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp').default('jpg'),
  quality: Joi.number().min(1).max(100).default(80),
  width: Joi.number().min(1).max(10000).optional(),
  height: Joi.number().min(1).max(10000).optional()
});

const videoTrimParams = Joi.object({
  startTime: Joi.string().pattern(/^\d{2}:\d{2}:\d{2}$/).default('00:00:00'),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}:\d{2}$/).optional(),
  duration: Joi.string().pattern(/^\d{2}:\d{2}:\d{2}$/).optional()
}).or('endTime', 'duration');


const pdfExtractParams = Joi.object({
  extractImages: Joi.boolean().default(false),
  extractTables: Joi.boolean().default(false),
  pageRange: Joi.object({
    start: Joi.number().min(1).optional(),
    end: Joi.number().min(1).optional()
  }).optional(),
  outputFormat: Joi.string().valid('text', 'json', 'markdown').default('text')
});

const csvAnalyzeParams = Joi.object({
  delimiter: Joi.string().length(1).default(','),
  hasHeader: Joi.boolean().default(true),
  analysisType: Joi.string().valid('basic', 'detailed', 'statistical').default('basic'),
  columns: Joi.array().items(Joi.string()).optional(),
  generateCharts: Joi.boolean().default(false)
});


const validateTask = async (req, res, next) => {
  try {
    const { error: taskError, value: taskValue } = taskSchema.validate(req.body);
    if (taskError) {
      return res.status(400).json({ error: taskError.details[0].message });
    }

    let parameters = taskValue.parameters;
    if (typeof parameters === 'string') {
      try {
        parameters = JSON.parse(parameters);
      } catch (parseError) {
        return res.status(400).json({ error: 'Invalid JSON in parameters' });
      }
    }

    let paramValidation;
    switch (taskValue.type) {
      case 'image-convert':
        paramValidation = imageConvertParams.validate(parameters);
        break;
      case 'video-trim':
        paramValidation = videoTrimParams.validate(parameters);
        break;
      case 'pdf-extract':
        paramValidation = pdfExtractParams.validate(parameters);
        break;
      case 'csv-analyze':
        paramValidation = csvAnalyzeParams.validate(parameters);
        break;
      default:
        return res.status(400).json({ error: 'Unknown task type' });
    }

    if (paramValidation.error) {
      return res.status(400).json({
        error: `Parameter validation failed: ${paramValidation.error.details[0].message}`
      });
    }

    req.body.type = taskValue.type;
    req.body.parameters = paramValidation.value;
    next();
  } catch (error) {
    logger.error('Validation error:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
};

const validatePagination = (req, res, next) => {
  const schema = Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    sortBy: Joi.string().valid('createdAt', 'status', 'type').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  });

  const { error, value } = schema.validate(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  req.pagination = value;
  next();
};

module.exports = { 
  validateTask, 
  validatePagination 
};