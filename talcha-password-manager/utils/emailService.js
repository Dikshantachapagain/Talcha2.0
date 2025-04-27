const nodemailer = require('nodemailer');

// Configure mail transporter with error handling
const createTransporter = () => {
  console.log("Creating email transporter with:", {
    service: process.env.EMAIL_SERVICE || 'gmail',
    user: process.env.EMAIL_USER,
    hasPassword: process.env.EMAIL_PASSWORD ? "Yes (not shown)" : "No"
  });

  const transport = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    // Add connection pooling to avoid rate limits
    pool: true,
    // Retry on failure
    maxConnections: 1,
    maxMessages: 10,
    rateDelta: 1000,
    rateLimit: 5
  });

  // Verify connection configuration
  transport.verify(function(error, success) {
    if (error) {
      console.error('SMTP connection error:', error);
    } else {
      console.log('SMTP connection successful, server ready to send emails');
    }
  });

  return transport;
};

// Create the transporter only once
let transporter;
try {
  transporter = createTransporter();
} catch (err) {
  console.error('Failed to create email transporter:', err);
  // Fallback to development mode transporter
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('\n============ EMAIL WOULD BE SENT ============');
      console.log('To:', mailOptions.to);
      console.log('Subject:', mailOptions.subject);
      console.log('Content:', mailOptions.html?.substring(0, 500) + '...');
      console.log('============================================\n');
      
      return { 
        messageId: 'dev-mode-' + Date.now(),
        response: 'Development mode - email not actually sent'
      };
    }
  };
}

// Send email verification
exports.sendVerificationEmail = async (email, username, token) => {
  const verificationUrl = `${process.env.BASE_URL}/auth/verify-email/${token}`;
  
  const mailOptions = {
    from: `"Talcha Password Manager" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - Talcha Password Manager',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a6ee0;">Verify Your Email Address</h2>
        <p>Hello ${username},</p>
        <p>Thank you for registering with Talcha Password Manager. Please click the button below to verify your email address:</p>
        <a href="${verificationUrl}" style="display: inline-block; background-color: #4a6ee0; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin: 20px 0;">Verify Email</a>
        <p>If you didn't create an account with us, please ignore this email.</p>
        <p>This link will expire in 24 hours.</p>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p>${verificationUrl}</p>
        <p>Thank you,<br>Talcha Password Manager Team</p>
      </div>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw error;
  }
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, username, token) => {
  const resetUrl = `${process.env.BASE_URL}/auth/reset-password/${token}`;
  
  const mailOptions = {
    from: `"Talcha Password Manager" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your Password - Talcha Password Manager',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a6ee0;">Reset Your Password</h2>
        <p>Hello ${username},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #4a6ee0; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin: 20px 0;">Reset Password</a>
        <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
        <p>This link will expire in 1 hour.</p>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p>${resetUrl}</p>
        <p>Thank you,<br>Talcha Password Manager Team</p>
      </div>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
};

// Send 2FA backup codes
exports.sendTwoFactorBackupCodes = async (email, username, backupCodes) => {
  const mailOptions = {
    from: `"Talcha Password Manager" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your 2FA Backup Codes - Talcha Password Manager',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a6ee0;">Your Two-Factor Authentication Backup Codes</h2>
        <p>Hello ${username},</p>
        <p>You've successfully enabled two-factor authentication. Here are your backup codes:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace;">
          ${backupCodes.map(code => `<div>${code}</div>`).join('')}
        </div>
        <p style="color: #d9534f; font-weight: bold;">Important: Store these codes securely. They will allow you to access your account if you lose access to your authenticator app.</p>
        <p>Each code can only be used once. We recommend saving them in a secure location, separate from your password manager.</p>
        <p>Thank you,<br>Talcha Password Manager Team</p>
      </div>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('2FA backup codes email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send 2FA backup codes email:', error);
    throw error;
  }
};

module.exports = exports;