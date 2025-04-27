// utils/auditService.js
const AuditLog = require('../models/AuditLog');
const geoip = require('geoip-lite'); // You'll need to install this package

/**
 * Log an audit event
 */
exports.logEvent = async (req, action, passwordId = null, targetWebsite = null) => {
  try {
    // Get IP address and try to determine location
    /*const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    let location = null;
    
    if (ip) {
      const geo = geoip.lookup(ip);
      if (geo) {
        location = `${geo.city}, ${geo.region}, ${geo.country}`;
      }
    }*/
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      let location = null;
      
      if (ip === '127.0.0.1' || ip === '::1' || ip.includes('192.168.')) {
        location = 'Local Development';
        // Displays a more meaningful value for localhost
        displayIp = 'localhost (127.0.0.1)';
      } else {
        const geo = geoip.lookup(ip);
        if (geo) {
          location = `${geo.city}, ${geo.region}, ${geo.country}`;
        } else {
          location = 'Unknown Location';
        }
        displayIp = ip;
      }
      
    // Create new audit log entry
    const auditLog = new AuditLog({
      user: req.session.user.id,
      action,
      passwordId,
      targetWebsite,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      deviceInfo: extractDeviceInfo(req.headers['user-agent']),
      location
    });
    
    await auditLog.save();
    
    return auditLog;
  } catch (error) {
    console.error('Audit logging error:', error);
    // Fail silently - don't let audit logging errors break functionality
    return null;
  }
};

/**
 * Extract basic device info from user agent
 */
function extractDeviceInfo(userAgent) {
  if (!userAgent) return 'Unknown';
  
  // Simple extraction logic - could be more sophisticated
  if (userAgent.includes('Mobile')) {
    return 'Mobile Device';
  } else if (userAgent.includes('Win')) {
    return 'Windows PC';
  } else if (userAgent.includes('Mac')) {
    return 'Mac';
  } else if (userAgent.includes('Linux')) {
    return 'Linux';
  } else {
    return 'Desktop Computer';
  }
}