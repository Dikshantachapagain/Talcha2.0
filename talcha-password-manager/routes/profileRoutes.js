const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');
const { analyzePasswordStrength } = require('../utils/passwordStrength');
const { checkPasswordCompromised } = require('../utils/pwnedChecker');
const profileController = require('../controllers/profileController');

// Get profile page
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    
    if (!user) {
      return res.status(404).render('error', { error: 'User not found' });
    }
    
    // Get query parameters for success message
    const success = req.query.success;
    
    res.render('profile', {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isTwoFactorEnabled: user.isTwoFactorEnabled
      },
      success: success ? decodeURIComponent(success) : null
    });
  } catch (error) {
    console.error('Profile page error:', error);
    res.status(500).render('error', { error: 'Failed to load profile' });
  }
});

// Change master password
router.post('/change-password', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    
    if (newPassword !== confirmNewPassword) {
      return res.render('profile', {
        error: 'New passwords do not match',
        user: req.session.user
      });
    }
    
    const user = await User.findById(req.session.user.id);
    
    if (!user) {
      return res.status(404).render('error', { error: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    
    if (!isMatch) {
      return res.render('profile', {
        error: 'Current password is incorrect',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isTwoFactorEnabled: user.isTwoFactorEnabled
        }
      });
    }
    
    // Check new password strength
    const strengthResult = analyzePasswordStrength(newPassword);
    if (strengthResult.score < 50) {
      return res.render('profile', {
        error: 'New password is too weak. Please choose a stronger password.',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isTwoFactorEnabled: user.isTwoFactorEnabled
        }
      });
    }
    
    // Check if new password has been compromised
    try {
      const pwnedResult = await checkPasswordCompromised(newPassword);
      if (pwnedResult.compromised) {
        return res.render('profile', {
          error: pwnedResult.message,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            isTwoFactorEnabled: user.isTwoFactorEnabled
          }
        });
      }
    } catch (err) {
      console.error('Error checking password compromise status:', err);
      // Continue with password change even if pwned check fails
    }
    // IMPORTANT: Fetch all user's passwords and re-encrypt them with the new master password
    try {
      const { encrypt, decrypt } = require('../utils/encryption');
      const Password = require('../models/Password');
      
      console.log('Beginning password re-encryption process...');
      
      // Fetch all user passwords
      const userPasswords = await Password.find({ user: user._id });
      console.log(`Found ${userPasswords.length} passwords to re-encrypt`);
      
      // Re-encrypt each password with the new master password
      for (const passwordEntry of userPasswords) {
        try {
          // Decrypt with old master password
          const decryptedValue = decrypt(passwordEntry.password, currentPassword);
          
          // Re-encrypt with new master password
          const newEncrypted = encrypt(decryptedValue, newPassword);
          
          // Update in database
          passwordEntry.password = newEncrypted;
          await passwordEntry.save();
        } catch (reEncryptError) {
          console.error(`Failed to re-encrypt password ID ${passwordEntry._id}:`, reEncryptError);
          // Consider how to handle this - maybe mark passwords that couldn't be migrated?
        }
      }
      
      console.log('Password re-encryption completed successfully');
    } catch (migrationError) {
      console.error('Error during password migration:', migrationError);
      return res.render('profile', {
        error: 'There was an error updating your stored passwords. Some passwords may not be accessible.',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isTwoFactorEnabled: user.isTwoFactorEnabled
        }
      });
    }
    // Update password
    user.password = newPassword;
    await user.save();
    
    // Update session's master key
    req.session.user.masterKey = newPassword;
    
    return res.redirect('/passwords/profile?success=Password+changed+successfully');
    
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).render('profile', {
      error: 'An error occurred while changing your password',
      user: req.session.user
    });
  }
});
//Audit trail route
router.get('/audit-trail', isAuthenticated,profileController.getAuditTrail);
module.exports = router;