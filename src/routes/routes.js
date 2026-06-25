// 📁 PATH: src/routes/routes.js  (updated)
'use strict';

const express = require('express');
const router  = express.Router();

const { signupController, signinController, verifyEmailController, resendOtpController, forgotPasswordController, resetPasswordController, signinVerifiedController } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

/* ── Public routes (login দরকার নেই) ──────────────────── */
router.post('/register', signupController);
router.post('/signin',   signinController);
router.post('/signin-verified',  signinVerifiedController);  // ← NEW
router.post('/verify-email',  verifyEmailController);   
router.post('/resend-otp',    resendOtpController);  
router.post('/forgot-password', forgotPasswordController);  // ← NEW
router.post('/reset-password',  resetPasswordController);   // ← NEW   

/* ── Protected route example ───────────────────────────── */
// /me → logged in user এর নিজের info পাবে
router.get('/me', protect, (req, res) => {
  // protect middleware req.user attach করে দেয়
  res.json({
    id:        req.user._id,
    firstName: req.user.firstName,
    lastName:  req.user.lastName,
    email:     req.user.email,
    phone:     req.user.phone,
    role:      req.user.role,
  });
});

module.exports = router;

