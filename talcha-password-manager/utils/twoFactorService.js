const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Generate a new 2FA secret
exports.generateSecret = (username) => {
  // Generate a secret
  const secret = speakeasy.generateSecret({
    name: `Talcha Password Manager (${username})`
  });
  
  return {
    otpauth_url: secret.otpauth_url,
    base32: secret.base32
  };
};

// Generate QR code from otpauth URL
exports.generateQRCode = async (otpauthUrl) => {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

// Verify TOTP token
exports.verifyToken = (token, secret) => {
  console.log('Verifying token:', token, 'with secret prefix:', secret.substring(0, 5) + '...');
  
  // Try with different windows to account for time drift
  for (let window = 0; window <= 4; window++) {
    const result = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token.toString(), // Ensure token is string
      window: window // Increase tolerance for time drift
    });
    
    if (result) {
      console.log('Token verified successfully with window:', window);
      return true;
    }
  }
  
  console.log('Token verification failed for all time windows');
  return false;
};

module.exports = exports;