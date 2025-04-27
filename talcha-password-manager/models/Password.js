const mongoose = require('mongoose');

const PasswordSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  username: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  notes: {
    type: String
  },
  category: {
    type: String,
    default: 'General'
  },
  strengthScore: {
    type: Number,
    min: 0,
    max: 100
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the 'updatedAt' field before updating
PasswordSchema.pre('findOneAndUpdate', function() {
  this.set({ updatedAt: Date.now() });
});

const Password = mongoose.model('Password', PasswordSchema);

module.exports = Password;