const mongoose = require('mongoose');   
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: null
    }
});
   

userSchema.pre('save',async function(next){
    if(!this.isModified('password')) return next();
    try{
        const salt=await bcrypt.genSalt(12);
        this.password=await bcrypt.hash(this.password,salt);
        next();
    }catch(err){
        next(err);
    }
})
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};
userSchema.methods.toJSON = function() {
    const userObject=this.toObject();
    delete userObject.password;
    return userObject;
}


module.exports = mongoose.model('User', userSchema);