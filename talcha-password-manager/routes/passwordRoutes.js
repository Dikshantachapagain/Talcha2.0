const express = require('express');
const router = express.Router();
const passwordController = require('../controllers/passwordController');
const { isAuthenticated, hasMasterKey } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuthenticated);
router.use(hasMasterKey);

// GET routes
router.get('/dashboard', passwordController.getDashboard);
router.get('/add', passwordController.getAddPasswordPage);
router.get('/edit/:id', passwordController.getEditPasswordPage);

// POST routes
router.post('/add', passwordController.addPassword);
router.post('/edit/:id', passwordController.updatePassword);
router.post('/delete/:id', passwordController.deletePassword);
router.post('/generate', passwordController.generatePassword);
router.post('/check-strength', passwordController.checkPasswordStrength);
router.post('/check-ompromised', passwordController.checkPasswordCompromised);

module.exports = router;