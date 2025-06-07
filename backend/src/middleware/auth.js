const jwt = require('jsonwebtoken');
const User=require('../models/User');
const logger = require('../utils/logger');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'hello', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid access token' });
        }
        req.user = user;
        next();
    });
}

const requireAuth=async(req,res,next)=>{    
    try{
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user || !user.isActive) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        req.user = user;
        next();
    } catch (err) {
        logger.error('Authorization error:', err);
        res.status(403).json({ error: 'Forbidden' });
    }
}

module.exports = {
    authenticateToken,
    requireAuth
};

