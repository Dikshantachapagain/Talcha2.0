const Password = require('../models/Password');
const { encrypt, decrypt } = require('../utils/encryption');
const { analyzePasswordStrength } = require('../utils/passwordStrength');
const { checkPasswordCompromised } = require('../utils/pwnedChecker');
const { generatePassword } = require('../utils/passwordGenerator');
const auditService= require ('../utils/auditService');

// Get dashboard page
exports.getDashboard = async (req, res) => {
  try {
    console.log('Loading dashboard for user ID:', req.session.user.id);
    
    // Make sure user ID exists
    if (!req.session.user || !req.session.user.id) {
      console.error('User ID missing from session');
      return res.redirect('/auth/login');
    }
    
    const passwords = await Password.find({ user: req.session.user.id })
      .sort({ updatedAt: -1 });
    
    console.log(`Found ${passwords.length} passwords for user`);
    
    // Make sure masterKey exists
    if (!req.session.user.masterKey) {
      console.error('Master key missing from session');
      // Use a fallback for testing - in production you'd redirect to login
      req.session.user.masterKey = 'temporary-master-key';
    }
    
    // Decrypt passwords for display with error handling
    const decryptedPasswords = [];
    for (const password of passwords) {
      try {
        const decrypted = {
          ...password.toObject(),
          passwordText: decrypt(password.password, req.session.user.masterKey)
        };
        decryptedPasswords.push(decrypted);
      } catch (decryptError) {
        console.error('Error decrypting password:', decryptError);
        // Still include the password but with a placeholder
        const decrypted = {
          ...password.toObject(),
          passwordText: '[Decryption error]'
        };
        decryptedPasswords.push(decrypted);
      }
    }
    
    console.log('Successfully decrypted passwords for display');
    
    // Display any messages from session
    const warning = req.session.warning;
    if (warning) {
      console.log('Warning to display:', warning);
      delete req.session.warning;
    }
    
    const success = req.session.success;
    if (success) {
      console.log('Success message to display:', success);
      delete req.session.success;
    }
    
    res.render('dashboard', {
      passwords: decryptedPasswords,
      user: req.session.user,
      warning,
      success
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { error: 'Failed to load dashboard: ' + error.message });
  }
};

// Get add password page
exports.getAddPasswordPage = (req, res) => {
  res.render('add-password', {
    user: req.session.user
  });
};

// Add new password
exports.addPassword = async (req, res) => {
  try {
    console.log('Adding new password, request body:', req.body);
    const { title, website, username, email, passwordText, notes, category, ignoreCompromised } = req.body;
    
    if (!title || !passwordText) {
      return res.status(400).render('add-password', {
        error: 'Title and password are required',
        user: req.session.user,
        formData: req.body
      });
    }
    
    // Analyze password strength
    const strengthResult = analyzePasswordStrength(passwordText);
    console.log('Password strength analysis:', strengthResult);
    
    // Check if password has been compromised (unless user chose to ignore)
    if (ignoreCompromised !== 'true') {
      let pwnedResult = { compromised: false };
      try {
        pwnedResult = await checkPasswordCompromised(passwordText);
        console.log('Password compromised check result:', pwnedResult);
        
        // If password is compromised, notify the user but let them decide
        if (pwnedResult.compromised) {
          return res.render('add-password', {
            warning: `This password has been found in ${pwnedResult.count.toLocaleString()} data breaches. Using it is not recommended.`,
            compromised: true,
            user: req.session.user,
            formData: req.body
          });
        }
      } catch (pwdError) {
        console.error('Error checking if password is compromised (continuing anyway):', pwdError);
      }
    } else {
      console.log('User chose to use compromised password anyway');
    }
    
    // Encrypt the password - make sure masterKey exists
    if (!req.session.user || !req.session.user.masterKey) {
      console.error('Master key missing from session');
      req.session.user = req.session.user || {};
      // Use a fallback for testing - in production you'd redirect to login
      req.session.user.masterKey = req.session.user.masterKey || 'temporary-master-key';
    }
    
    const encryptedPassword = encrypt(passwordText, req.session.user.masterKey);
    console.log('Password encrypted successfully');
    
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
    
    console.log('Saving password to database...');
    await newPassword.save();
    console.log('Password saved successfully with ID:', newPassword._id);
    //Log the create event
    await auditService.logEvent(req, 'create', newPassword._id, website);

    // Add a success message if user ignored compromised warning
    if (ignoreCompromised === 'true') {
      req.session.success = 'Password saved successfully. Remember to change it soon for better security.';
    }
    
    res.redirect('/passwords/dashboard');
  } catch (error) {
    console.error('Add password error:', error);
    res.status(500).render('add-password', {
      error: 'Failed to add password: ' + error.message,
      user: req.session.user,
      formData: req.body
    });
  }
};

// Get edit password page
// Get edit password page
exports.getEditPasswordPage = async (req, res) => {
  try {
    const password = await Password.findOne({
      _id: req.params.id,
      user: req.session.user.id
    });
    
    if (!password) {
      return res.status(404).render('error', { error: 'Password not found' });
    }
    
    // Decrypt the password for display
    const decryptedPassword = {
      ...password.toObject(),
      passwordText: decrypt(password.password, req.session.user.masterKey)
    };
   
    // Log the view event for specific password
    await auditService.logEvent(req, 'view', password._id, password.website);



    res.render('edit-password', {
      password: decryptedPassword,
      user: req.session.user
    });
  } catch (error) {
    console.error('Edit password error:', error);
    res.status(500).render('error', { error: 'Failed to load password' });
  }
};

// Update password
exports.updatePassword = async (req, res) => {
  try {
    const { title, website, username, email, passwordText, notes, category, ignoreCompromised } = req.body;
    
    // Find the password
    const password = await Password.findOne({
      _id: req.params.id,
      user: req.session.user.id
    });
    
    if (!password) {
      return res.status(404).render('error', { error: 'Password not found' });
    }
    
    // Analyze password strength
    const strengthResult = analyzePasswordStrength(passwordText);
    
    // Check if password has been compromised (unless user chose to ignore)
    if (ignoreCompromised !== 'true') {
      let pwnedResult = { compromised: false };
      try {
        pwnedResult = await checkPasswordCompromised(passwordText);
        
        // If password is compromised, notify the user but let them decide
        if (pwnedResult.compromised) {
          // Get the current password for the form
          const currentPassword = {
            ...password.toObject(),
            passwordText: decrypt(password.password, req.session.user.masterKey)
          };
          
          return res.render('edit-password', {
            password: currentPassword,
            warning: `This password has been found in ${pwnedResult.count.toLocaleString()} data breaches. Using it is not recommended.`,
            compromised: true,
            user: req.session.user,
            formData: req.body
          });
        }
      } catch (pwdError) {
        console.error('Error checking if password is compromised (continuing anyway):', pwdError);
      }
    }
    
    // Encrypt the password
    const encryptedPassword = encrypt(passwordText, req.session.user.masterKey);
    
    // Update the password
    password.title = title;
    password.website = website;
    password.username = username;
    password.email = email;
    password.password = encryptedPassword;
    password.notes = notes;
    password.category = category || 'General';
    password.strengthScore = strengthResult.score;
    password.updatedAt = Date.now();
    
    await password.save();

    await auditService.logEvent(req, 'update', password._id, website);
    
    // Add a success message if user ignored compromised warning
    if (ignoreCompromised === 'true') {
      req.session.success = 'Password updated successfully. Remember to change it soon for better security.';
    }
    
    res.redirect('/passwords/dashboard');
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).render('error', { error: 'Failed to update password: ' + error.message });
  }
};

// Delete password
exports.deletePassword = async (req, res) => {
  try {
    const result = await Password.deleteOne({
      _id: req.params.id,
      user: req.session.user.id
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Password not found' });
    }
    

    //Log of the delete event
    await auditService.logEvent(req, 'delete',req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete password error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete password' });
  }
};

// Generate password
exports.generatePassword = (req, res) => {
  const { length, uppercase, lowercase, numbers, symbols } = req.body;
  
  const password = generatePassword(
    parseInt(length) || 16,
    uppercase === 'true'||  uppercase === true,
  lowercase === 'true'|| lowercase === true,
  numbers === 'true'|| numbers === true,
  symbols === 'true'|| symbols === true

  );
  const strengthResult = analyzePasswordStrength(password);
  
  res.json({
    password,
    strength: strengthResult
  });
};

// Check password strength
exports.checkPasswordStrength = (req, res) => {
  const { password } = req.body;
  
  const strengthResult = analyzePasswordStrength(password);
  
  res.json(strengthResult);
};

// Check if password has been compromised
exports.checkPasswordCompromised = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: true, message: 'Password is required' });
    }
    
    console.log('Checking if password has been compromised...');
    const result = await checkPasswordCompromised(password);
    console.log('HIBP API check result:', { compromised: result.compromised, count: result.count });
    
    res.json(result);
  } catch (error) {
    console.error('Check compromised error:', error);
    res.status(500).json({ 
      error: true, 
      message: 'Failed to check if password has been compromised',
      details: error.message
    });
  }
};