const User = require('../models/User');
const { analyzePasswordStrength } = require('../utils/passwordStrength');
const { checkPasswordCompromised } = require('../utils/pwnedChecker');
const emailService = require('../utils/emailService');
const twoFactorService = require('../utils/twoFactorService');

// Register a new user
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      return res.status(400).render('register', {
        error: 'User with that email or username already exists',
        username,
        email
      });
    }
    
    // Check password strength
    const strengthResult = analyzePasswordStrength(password);
    if (strengthResult.score < 50) {
      return res.status(400).render('register', {
        error: 'Password is too weak. Please choose a stronger password.',
        feedback: strengthResult.feedback,
        username,
        email
      });
    }
    
    // Check if password has been compromised
    try {
      const pwnedResult = await checkPasswordCompromised(password);
      if (pwnedResult.compromised) {
        return res.status(400).render('register', {
          error: pwnedResult.message,
          username,
          email
        });
      }
    } catch (err) {
      console.error('Error checking password compromise status:', err);
      // Continue with registration even if pwned check fails
    }
    
    // Create new user
    const user = new User({
      username,
      email,
      password
    });
    
    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    
    await user.save();
    
    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, user.username, verificationToken);
      return res.render('verify-email', {
        message: 'Registration successful! Please check your email to verify your account.',
        email: user.email
      });
    } catch (err) {
      console.error('Error sending verification email:', err);
      return res.render('verify-email', {
        error: 'Registration successful, but we could not send a verification email. Please contact support.',
        email: user.email
      });
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).render('register', {
      error: 'An error occurred during registration'
    });
  }
};

// Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const token = req.params.token;
    
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.render('verify-email', {
        error: 'Email verification token is invalid or has expired.'
      });
    }
    
    // Update user
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    
    await user.save();
    
    return res.render('login', {
      success: 'Email verified successfully! You can now log in.'
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).render('verify-email', {
      error: 'An error occurred during email verification.'
    });
  }
};

// Resend verification email
exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.render('verify-email', {
        error: 'No account with that email address exists.',
        email
      });
    }
    
    if (user.isEmailVerified) {
      return res.render('login', {
        success: 'Your email is already verified. You can log in.',
        email
      });
    }
    
    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    
    // Send verification email
    await emailService.sendVerificationEmail(user.email, user.username, verificationToken);
    
    return res.render('verify-email', {
      message: 'Verification email resent. Please check your inbox.',
      email: user.email
    });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).render('verify-email', {
      error: 'An error occurred while resending the verification email.'
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username },
        { email: username } // Allow login with email as well
      ]
    });
    
    if (!user) {
      return res.status(400).render('login', {
        error: 'Invalid credentials',
        username
      });
    }
    
    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.render('verify-email', {
        error: 'Please verify your email before logging in.',
        email: user.email
      });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(400).render('login', {
        error: 'Invalid credentials',
        username
      });
    }
    
    // If 2FA is enabled, redirect to 2FA verification
    if (user.isTwoFactorEnabled) {
      // Create a temporary session to indicate successful first step
      req.session.twoFactorAuth = {
        userId: user._id,
        username: user.username,
        remember: req.body.remember === 'on',
        password: password //Store the password
      };
      
      return res.redirect('/auth/2fa-verify');
    }
    
    // Set user session
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      // Store master key derived from password in session
      // This will be used to decrypt passwords
      masterKey: password
    };
    
    // Set remember me cookie if selected
    if (req.body.remember === 'on') {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    
    console.log('User logged in successfully:', user.username);
    console.log('Session data set:', req.session.user);
    
    return res.redirect('/passwords/dashboard');
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).render('login', {
      error: 'An error occurred during login'
    });
  }
};

// Get 2FA verification page
exports.getTwoFactorVerifyPage = (req, res) => {
  if (!req.session.twoFactorAuth) {
    return res.redirect('/auth/login');
  }
  
  res.render('2fa-verify', {
    username: req.session.twoFactorAuth.username
  });
};

// Verify 2FA token
// Verify 2FA token
exports.verifyTwoFactor = async (req, res) => {
  try {
    if (!req.session.twoFactorAuth) {
      return res.redirect('/auth/login');
    }
    
    const { token, backupCode } = req.body;
    const userId = req.session.twoFactorAuth.userId;
    
    console.log('2FA verification attempt for user:', userId);
    console.log('Token provided:', token);
    console.log('Backup code provided:', backupCode ? 'Yes' : 'No');
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(400).render('2fa-verify', {
        error: 'User not found'
      });
    }
    
    console.log('User found, 2FA secret exists:', !!user.twoFactorSecret);
    
    let isValid = false;
    
    // DEVELOPMENT ONLY - REMOVE IN PRODUCTION
    if (token === '000000' || token === '123456') {
      console.log('DEVELOPMENT: Using master debug code');
      isValid = true;
    }
    // Check if using token or backup code
    else if (token) {
      // Verify token
      isValid = twoFactorService.verifyToken(token, user.twoFactorSecret);
      console.log('Token validation result:', isValid);
    } else if (backupCode) {
      // Verify backup code
      isValid = await user.verifyBackupCode(backupCode);
      console.log('Backup code validation result:', isValid);
    }
    
    if (!isValid) {
      // For debugging: show more details about token
      if (token) {
        try {
          const speakeasy = require('speakeasy');
          // Calculate what the current token should be
          const currentToken = speakeasy.totp({
            secret: user.twoFactorSecret,
            encoding: 'base32'
          });
          console.log('Expected token for exact time match:', currentToken);
        } catch (err) {
          console.error('Error generating current token for comparison:', err);
        }
      }
      
      return res.status(400).render('2fa-verify', {
        error: 'Invalid verification code',
        username: user.username
      });
    }
    
    // Successful 2FA verification
    // Set user session
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      masterKey: req.session.twoFactorAuth.password || ''
    };
    
    // Set remember me cookie if selected
    if (req.session.twoFactorAuth.remember) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    //Explicitly save the session before redirecting
    req.session.save(err =>{
      if(err){
        console.error('Error saving session:',err);
        return res.status(500).render('2fa-verify',{
          error: 'An error occured during verification',
          username: user.name
        });
      }
    })
    // Clear 2FA session
    delete req.session.twoFactorAuth;
    
    return res.redirect('/passwords/dashboard');
    
  } catch (error) {
    console.error('2FA verification error:', error);
    return res.status(500).render('2fa-verify', {
      error: 'An error occurred during verification'
    });
  }
};

// Logout user
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Error logging out');
    }
    
    res.redirect('/');
  });
};

// Get forgot password page
exports.getForgotPasswordPage = (req, res) => {
  res.render('forgot-password');
};

// Send password reset email
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.render('forgot-password', {
        error: 'No account with that email address exists'
      });
    }
    
    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();
    
    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, user.username, resetToken);
      return res.render('forgot-password', {
        message: 'Password reset email sent. Please check your inbox.'
      });
    } catch (err) {
      console.error('Error sending reset email:', err);
      
      // Reset the token if email failed
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      
      return res.render('forgot-password', {
        error: 'Unable to send reset email. Please try again later.'
      });
    }
    
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).render('forgot-password', {
      error: 'An error occurred while processing your request'
    });
  }
};

// Get reset password page
exports.getResetPasswordPage = async (req, res) => {
  try {
    const token = req.params.token;
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.render('forgot-password', {
        error: 'Password reset token is invalid or has expired'
      });
    }
    
    res.render('reset-password', {
      token
    });
    
  } catch (error) {
    console.error('Get reset password page error:', error);
    return res.status(500).render('forgot-password', {
      error: 'An error occurred'
    });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      return res.render('reset-password', {
        error: 'Passwords do not match',
        token
      });
    }
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.render('forgot-password', {
        error: 'Password reset token is invalid or has expired'
      });
    }
    
    // Check password strength
    const strengthResult = analyzePasswordStrength(password);
    if (strengthResult.score < 50) {
      return res.render('reset-password', {
        error: 'Password is too weak. Please choose a stronger password.',
        feedback: strengthResult.feedback,
        token
      });
    }
    
    // Check if password has been compromised
    try {
      const pwnedResult = await checkPasswordCompromised(password);
      if (pwnedResult.compromised) {
        return res.render('reset-password', {
          error: pwnedResult.message,
          token
        });
      }
    } catch (err) {
      console.error('Error checking password compromise status:', err);
      // Continue with reset even if pwned check fails
    }
    
    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();
    
    return res.render('login', {
      success: 'Your password has been reset. You can now log in with your new password.'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).render('reset-password', {
      error: 'An error occurred during password reset',
      token: req.body.token
    });
  }
};

// Get registration page
exports.getRegisterPage = (req, res) => {
  if (req.session.user) {
    return res.redirect('/passwords/dashboard');
  }
  
  res.render('register');
};

// Get login page
exports.getLoginPage = (req, res) => {
  if (req.session.user) {
    return res.redirect('/passwords/dashboard');
  }
  
  res.render('login');
};

// Setup 2FA
exports.getSetupTwoFactorPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
    
    const user = await User.findById(req.session.user.id);
    
    if (!user) {
      return res.status(404).render('error', { error: 'User not found' });
    }
    
    // Check if 2FA is already enabled
    if (user.isTwoFactorEnabled) {
      return res.redirect('/passwords/profile');
    }
    
    // Generate secret for TOTP
    const secret = twoFactorService.generateSecret(user.username);
    
    // Generate QR code
    const qrCode = await twoFactorService.generateQRCode(secret.otpauth_url);
    
    // Store secret temporarily in session
    req.session.twoFactorSetup = {
      secret: secret.base32
    };
    
    res.render('2fa-setup', {
      qrCode,
      secret: secret.base32
    });
    
  } catch (error) {
    console.error('Setup 2FA error:', error);
    return res.status(500).render('error', { error: 'An error occurred setting up 2FA' });
  }
};

// Verify and enable 2FA
exports.enableTwoFactor = async (req, res) => {
  try {
    if (!req.session.user || !req.session.twoFactorSetup) {
      return res.redirect('/auth/login');
    }
    
    const { token } = req.body;
    const secret = req.session.twoFactorSetup.secret;
    
    // Verify token
    const isValid = twoFactorService.verifyToken(token, secret);
    
    if (!isValid) {
      return res.render('2fa-setup', {
        error: 'Invalid verification code. Please try again.',
        qrCode: await twoFactorService.generateQRCode(
          `otpauth://totp/Talcha:${req.session.user.username}?secret=${secret}&issuer=Talcha`
        ),
        secret
      });
    }
    
    // Update user
    const user = await User.findById(req.session.user.id);
    
    if (!user) {
      return res.status(404).render('error', { error: 'User not found' });
    }
    
    user.twoFactorSecret = secret;
    user.isTwoFactorEnabled = true;
    
    // Generate backup codes
    const backupCodes = user.generateTwoFactorBackupCodes();
    
    await user.save();
    
    // Send backup codes to email
    try {
      await emailService.sendTwoFactorBackupCodes(user.email, user.username, backupCodes);
    } catch (err) {
      console.error('Error sending backup codes email:', err);
    }
    
    // Clear setup from session
    delete req.session.twoFactorSetup;
    
    // Show backup codes to user
    res.render('2fa-backup-codes', {
      backupCodes,
      success: '2FA has been successfully enabled for your account.'
    });
    
  } catch (error) {
    console.error('Enable 2FA error:', error);
    return res.status(500).render('error', { error: 'An error occurred enabling 2FA' });
  }
};

// Disable 2FA
exports.disableTwoFactor = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
    
    const { password } = req.body;
    
    const user = await User.findById(req.session.user.id);
    
    if (!user) {
      return res.status(404).render('error', { error: 'User not found' });
    }
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(400).render('profile', {
        error: 'Incorrect password',
        user: req.session.user
      });
    }
    
    // Disable 2FA
    user.twoFactorSecret = undefined;
    user.isTwoFactorEnabled = false;
    user.twoFactorBackupCodes = [];
    
    await user.save();
    
    res.redirect('/passwords/profile?success=2FA+has+been+disabled');
    
  } catch (error) {
    console.error('Disable 2FA error:', error);
    return res.status(500).render('error', { error: 'An error occurred disabling 2FA' });
  }
};