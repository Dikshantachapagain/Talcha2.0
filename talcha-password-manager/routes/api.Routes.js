const express = require('express');
const router = express.Router();
const Password = require('../models/Password');
const User = require('../models/User');
const { decrypt, encrypt } = require('../utils/encryption');
const { generatePassword } = require('../utils/passwordGenerator');
const { analyzePasswordStrength } = require('../utils/passwordStrength');
const { checkPasswordCompromised } = require('../utils/pwnedChecker');
const { isAuthenticated, hasMasterKey } = require('../middleware/auth');

// CORS middleware for Chrome extension
router.use((req, res, next) => {
  // During development, you'll replace YOUR_EXTENSION_ID with your actual extension ID
  res.header('Access-Control-Allow-Origin', 'chrome-extension:// lmmcfgkgldlnmlfdlkngdfbcgokfaijj');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Add endpoint to check authentication status
router.get('/check-auth', (req, res) => {
  console.log('Session check:', req.session);
  res.json({
    authenticated: !!req.session.user,
    sessionExists: !!req.session,
    sessionID: req.sessionID,
    userInfo: req.session.user ? {
      id: req.session.user.id,
      username: req.session.user.username
    } : null
  });
});

// Authentication endpoint for the extension
router.post('/login', async (req, res) => {
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
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(401).json({ success: false, message: 'Please verify your email before logging in' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // If 2FA is enabled, return that status
    if (user.isTwoFactorEnabled) {
      return res.json({ 
        success: true, 
        requiresTwoFactor: true,
        userId: user._id 
      });
    }
    
    // Login successful - create a session token
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      masterKey: password
    };
    
    console.log('Login successful, session set:', req.sessionID);
    
    res.json({ 
      success: true, 
      requiresTwoFactor: false,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      },
      sessionID: req.sessionID
    });
    
  } catch (error) {
    console.error('API login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Force login endpoint for extension
router.post('/force-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    
    // Find user
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Set session
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      masterKey: password
    };
    
    console.log('Force login successful, session set:', req.sessionID);
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      sessionID: req.sessionID
    });
  } catch (error) {
    console.error('Force login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Two-factor authentication verification
router.post('/verify-2fa', async (req, res) => {
  try {
    const { userId, token, backupCode } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }
    
    let isValid = false;
    
    // Check if using token or backup code
    if (token) {
      // Verify token
      const twoFactorService = require('../utils/twoFactorService');
      isValid = twoFactorService.verifyToken(token, user.twoFactorSecret);
    } else if (backupCode) {
      // Verify backup code
      isValid = await user.verifyBackupCode(backupCode);
    }
    
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid verification code' });
    }
    
    // Successful verification - create session
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      masterKey: req.body.password || '' // You need to securely pass the password from the first step
    };
    
    res.json({ 
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('API 2FA verification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get credentials for specific domain
router.get('/credentials', isAuthenticated, hasMasterKey, async (req, res) => {
  try {
    const { domain } = req.query;
    
    console.log('----- Credentials Request -----');
    console.log('Domain requested:', domain);
    console.log('User session exists:', !!req.session.user);
    console.log('User ID:', req.session.user ? req.session.user.id : 'none');
    
    if (!domain) {
      return res.status(400).json({ success: false, message: 'Domain parameter is required' });
    }
    
    // Find credentials that match the domain or website
    const query = {
      user: req.session.user.id,
      $or: [
        { website: { $regex: domain, $options: 'i' } },
        { website: { $regex: `https?://(www\\.)?${domain}`, $options: 'i' } },
        { website: { $regex: `https?://${domain}`, $options: 'i' } }
      ]
    };
    
    console.log('Query:', JSON.stringify(query));
    
    const credentials = await Password.find(query);
    
    console.log(`Found ${credentials.length} credentials`);
    if (credentials.length > 0) {
      console.log('First credential website:', credentials[0].website);
    }
    
    // Decrypt passwords for the response
    const decryptedCredentials = credentials.map(cred => {
      try {
        return {
          id: cred._id,
          title: cred.title,
          website: cred.website,
          username: cred.username,
          email: cred.email,
          password: decrypt(cred.password, req.session.user.masterKey),
          category: cred.category,
          notes: cred.notes,
          strengthScore: cred.strengthScore,
          createdAt: cred.createdAt,
          updatedAt: cred.updatedAt
        };
      } catch (err) {
        console.error(`Error decrypting credential ${cred._id}:`, err);
        return {
          id: cred._id,
          title: cred.title,
          website: cred.website,
          username: cred.username,
          email: cred.email,
          password: '[Decryption failed]',
          category: cred.category,
          notes: cred.notes,
          strengthScore: cred.strengthScore,
          createdAt: cred.createdAt,
          updatedAt: cred.updatedAt
        };
      }
    });
    
    res.json({ success: true, credentials: decryptedCredentials });
    
  } catch (error) {
    console.error('API get credentials error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Generate password
router.post('/generate-password', async (req, res) => {
  try {
    const { length, uppercase, lowercase, numbers, symbols } = req.body;
    
    const password = generatePassword(
      parseInt(length) || 16,
      uppercase === 'true' || uppercase === true,
      lowercase === 'true' || lowercase === true,
      numbers === 'true' || numbers === true,
      symbols === 'true' || symbols === true
    );
    
    const strengthResult = analyzePasswordStrength(password);
    
    // Check if compromised
    let isCompromised = false;
    let compromisedCount = 0;
    
    try {
      const pwnedResult = await checkPasswordCompromised(password);
      isCompromised = pwnedResult.compromised;
      compromisedCount = pwnedResult.count || 0;
    } catch (err) {
      console.error('Error checking if password is compromised:', err);
      // Continue anyway
    }
    
    res.json({
      success: true,
      password,
      strength: strengthResult,
      compromised: {
        isCompromised,
        count: compromisedCount
      }
    });
    
  } catch (error) {
    console.error('API generate password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Save new password from extension
router.post('/save-password', isAuthenticated, hasMasterKey, async (req, res) => {
  try {
    const { title, website, username, email, password, notes, category } = req.body;
    
    if (!title || !password) {
      return res.status(400).json({ success: false, message: 'Title and password are required' });
    }
    
    // Analyze password strength
    const strengthResult = analyzePasswordStrength(password);
    
    // Encrypt the password
    const encryptedPassword = encrypt(password, req.session.user.masterKey);
    
    const newPassword = new Password({
      user: req.session.user.id,
      title,
      website,
      username,
      email,
      password: encryptedPassword,
      notes,
      category: category || 'General',
      strengthScore: strengthResult.score
    });
    
    await newPassword.save();
    
    res.json({ 
      success: true, 
      message: 'Password saved successfully',
      passwordId: newPassword._id
    });
    
  } catch (error) {
    console.error('API save password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Check if session is valid
router.get('/verify-session', (req, res) => {
  if (req.session.user) {
    res.json({ 
      valid: true,
      user: {
        id: req.session.user.id,
        username: req.session.user.username,
        email: req.session.user.email
      }
    });
  } else {
    res.json({ valid: false });
  }
});

module.exports = router;