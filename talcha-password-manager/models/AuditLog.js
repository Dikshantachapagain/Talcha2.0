// models/AuditLog.js
const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['view', 'create', 'update', 'delete', 'export', 'autofill', 'copy']
  },
  passwordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Password',
    default: null
  },
  targetWebsite: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  deviceInfo: {
    type: String,
    default: null
  },
  location: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Add an index for efficient querying
AuditLogSchema.index({ user: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

module.exports = AuditLog;