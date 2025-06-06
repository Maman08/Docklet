const express =require('express');
const jwt = require('jsonwebtoken');
const joi = require('joi');
const router = express.Router();
const User = require('../models/User');
const logger = require('../utils/logger');

const registerSchema = joi.object({
    username: joi.string().min(3).max(30).required(),
    email: joi.string().email().required(),
    password: joi.string().min(6).required()
});
const loginSchema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().min(6).required()
});
router.post('/register', async (req, res) => {
    try {
    const {error,value} = registerSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    
        const { username, email, password } =value;
        const existingUser = await User.findOne({ $or :[{email}, {username}] });
        if (existingUser) {
            return res.status(400).json({ error: 'User already registered' });
        }

        const user = new User({ username, email, password });
        await user.save();
        const token=generateToken(user._id);
        logger.info(`User registered: ${username}`);
        res.status(201).json({ message: 'User registered successfully',token,user:{id:user._id,username:user.username,email:user.email} });
    } catch (err) {
        logger.error('Registration error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/login', async (req, res) => {
    try {
    const {error,value} = loginSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    
        const { email, password }=value;
        const user = await User.findOne({ email ,isActive: true });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        await user.save();
        const token = generateToken(user._id);
        logger.info(`User logged in: ${user.username}`);
        res.json({ message: 'User loggedin successfully',token,user:{id:user._id,username:user.username,email:user.email} });
    } catch (err) {
        logger.error('Login error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/me',authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user.toJSON());
    } catch (err) {
        logger.error('Profile error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


router.post('/logout', (req, res) => {
    res.json({ message: 'User logged out successfully' });
});

function generateToken(userId) {    
    return jwt.sign({id:userId},process.env.JWT_SECRET || 'hello',{
        expiresIn: '1d'
    })
}
function authenticateToken(req,res,next){
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    jwt.verify(token,process.env.JWT_SECRET || 'hello', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid access token' });
        }
        req.user = user;
        next();
    }
    );  
}

module.exports = router;
