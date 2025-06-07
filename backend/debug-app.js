// debug-app.js - Run this to identify the exact error
const path = require('path');
const fs = require('fs');

console.log('=== DEBUGGING NODE.JS APPLICATION ===\n');

// Check if all required files exist
const requiredFiles = [
    'src/app.js',
    'src/config/database.js',
    'src/config/redis.js',
    'src/routes/auth.js',
    'src/routes/tasks.js',
    'src/routes/health.js',
    'src/services/taskRunner.js',
    'src/services/queueService.js',
    'src/services/dockerService.js',
    'src/models/Task.js',
    'src/models/User.js',
    'src/utils/logger.js',
    'src/utils/constants.js',
    'src/middleware/upload.js',
    'src/middleware/validation.js',
    'src/middleware/auth.js',
    'src/services/fileService.js'
];

console.log('1. Checking required files:');
const missingFiles = [];
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✓ ${file}`);
    } else {
        console.log(`✗ ${file} - MISSING`);
        missingFiles.push(file);
    }
});

if (missingFiles.length > 0) {
    console.log('\n❌ Missing files detected:', missingFiles);
    console.log('Please create these files or check your project structure.\n');
}

// Check environment variables
console.log('\n2. Checking environment variables:');
const envVars = [
    'MONGO_URI',
    'REDIS_URL',
    'JWT_SECRET',
    'PORT',
    'MAX_CONCURRENT_TASKS',
    'TASK_TIMEOUT'
];

envVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
        console.log(`✓ ${envVar}: ${envVar === 'JWT_SECRET' ? '[HIDDEN]' : value}`);
    } else {
        console.log(`⚠ ${envVar}: Not set (using default)`);
    }
});

// Check node_modules
console.log('\n3. Checking dependencies:');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies);

dependencies.forEach(dep => {
    try {
        require.resolve(dep);
        console.log(`✓ ${dep}`);
    } catch (error) {
        console.log(`✗ ${dep} - NOT INSTALLED`);
    }
});

// Try to load the main app file and catch the exact error
console.log('\n4. Testing main application file:');
try {
    require('./src/app.js');
    console.log('✓ Application loaded successfully');
} catch (error) {
    console.log('✗ Application failed to load:');
    console.log('ERROR:', error.message);
    console.log('STACK:', error.stack);
}