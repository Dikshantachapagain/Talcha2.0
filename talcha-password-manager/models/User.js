const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Email verification fields
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Reset password fields
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // Two-factor authentication fields
  twoFactorSecret: String,
  isTwoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorBackupCodes: [String]
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate email verification token
UserSchema.methods.generateEmailVerificationToken = function() {
  this.emailVerificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return this.emailVerificationToken;
};

// Generate password reset token
UserSchema.methods.generatePasswordResetToken = function() {
  this.resetPasswordToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
  return this.resetPasswordToken;
};

// Generate 2FA backup codes
UserSchema.methods.generateTwoFactorBackupCodes = function() {
  const backupCodes = [];
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex');
    backupCodes.push(code);
  }
  
  // Hash the backup codes before saving them
  this.twoFactorBackupCodes = backupCodes.map(code => 
    bcrypt.hashSync(code, 10)
  );
  
  return backupCodes; // Return plain codes to show to user once
};

// Verify a backup code and remove it if valid
UserSchema.methods.verifyBackupCode = async function(code) {
  for (let i = 0; i < this.twoFactorBackupCodes.length; i++) {
    const isValid = await bcrypt.compare(code, this.twoFactorBackupCodes[i]);
    if (isValid) {
      // Remove the used backup code
      this.twoFactorBackupCodes.splice(i, 1);
      await this.save();
      return true;
    }
  }
  return false;
};

const User = mongoose.model('User', UserSchema);

module.exports = User;