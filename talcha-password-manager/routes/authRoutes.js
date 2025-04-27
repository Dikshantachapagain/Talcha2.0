const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated, isNotAuthenticated } = require('../middleware/auth');

// Registration routes
router.get('/register', isNotAuthenticated, authController.getRegisterPage);
router.post('/register', isNotAuthenticated, authController.register);

// Email verification routes
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationEmail);

// Login routes
router.get('/login', isNotAuthenticated, authController.getLoginPage);
router.post('/login', isNotAuthenticated, authController.login);
router.get('/logout', authController.logout);

/*// Password reset routes
router.get('/forgot-password', isNotAuthenticated, authController.getForgotPasswordPage);
router.post('/forgot-password', isNotAuthenticated, authController.forgotPassword);
router.get('/reset-password/:token', isNotAuthenticated, authController.getResetPasswordPage);
router.post('/reset-password', isNotAuthenticated, authController.resetPassword);*/

// Two-factor authentication routes
router.get('/2fa-verify', authController.getTwoFactorVerifyPage);
router.post('/2fa-verify', authController.verifyTwoFactor);
router.get('/2fa-setup', isAuthenticated, authController.getSetupTwoFactorPage);
router.post('/2fa-setup', isAuthenticated, authController.enableTwoFactor);
router.post('/2fa-disable', isAuthenticated, authController.disableTwoFactor);

module.exports = router;