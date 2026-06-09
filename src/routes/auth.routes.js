'use strict';
const router = require('express').Router();
const { signupController, signinController } = require('../controllers/authController');
const ctrl = require('../controllers/auth.extra.controller');
const { protect } = require('../middleware/auth.middleware');

// Public
router.post('/register',       signupController);
router.post('/signup',         signupController);
router.post('/login',          ctrl.login);          // issues JWT access + refresh
router.post('/signin',         signinController);     // legacy
router.post('/refresh',        ctrl.refresh);
router.post('/logout',         ctrl.logout);
router.post('/forgot-password',ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);

// Protected
router.get('/me',          protect, ctrl.me);
router.patch('/me',        protect, ctrl.updateMe);
router.post('/change-password', protect, ctrl.changePassword);

module.exports = router;
