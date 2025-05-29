// controllers/profileController.js (or create a new controller)
const AuditLog = require('../models/AuditLog');
const Password = require('../models/Password');

// Get audit trail
exports.getAuditTrail = async (req, res) => {
  try {
    // Get filter parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;
    const filter = {};
    
    if (req.query.action) {
      filter.action = req.query.action;
      
    }
    
    if (req.query.dateFrom) {
      if (!filter.timestamp) filter.timestamp = {};
      filter.timestamp.$gte = new Date(req.query.dateFrom);
    }
    
    if (req.query.dateTo) {
      if (!filter.timestamp) filter.timestamp = {};
      filter.timestamp.$lte = new Date(req.query.dateTo);
    }
    
    // Always filter by user
    filter.user = req.session.user.id;
    
    // Get audit logs
    const auditLogs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await AuditLog.countDocuments(filter);
    
    // Get password titles for references
    const passwordIds = auditLogs
      .filter(log => log.passwordId)
      .map(log => log.passwordId);
    
    const passwords = await Password.find({
      _id: { $in: passwordIds }
    }, { _id: 1, title: 1 });
    
    const passwordMap = {};
    passwords.forEach(p => {
      passwordMap[p._id.toString()] = p.title;
    });
    
    // Prepare logs for display
    const formattedLogs = auditLogs.map(log => {
      return {
        action: formatAction(log.action),
        timestamp: log.timestamp,
        formattedTime: formatTime(log.timestamp),
        website: log.targetWebsite || 'N/A',
        passwordTitle: log.passwordId ? 
          (passwordMap[log.passwordId.toString()] || 'Unknown') : 'N/A',
        device: log.deviceInfo || 'Unknown device',
        location: log.location || 'Location unknown',
        ipAddress: log.ipAddress || 'Unknown IP'
      };
    });
    
    res.render('audit-trail', {
      auditLogs: formattedLogs,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      },
      filters: req.query
    });
  } catch (error) {
    console.error('Audit trail error:', error);
    res.status(500).render('error', { error: 'Failed to load audit trail: ' + error.message });
  }
};

// Format action for display
function formatAction(action) {
  switch (action) {
    case 'view': return 'Viewed password';
    case 'create': return 'Created password';
    case 'update': return 'Updated password';
    case 'delete': return 'Deleted password';
    case 'export': return 'Exported password';
    case 'autofill': return 'Autofilled password';
    case 'copy': return 'Copied password';
    default: return action;
  }
}

// Format timestamp
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}