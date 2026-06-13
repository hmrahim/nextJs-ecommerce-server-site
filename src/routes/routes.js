// 📁 PATH: src/routes/routes.js  (updated)
'use strict';

const express = require('express');
const router  = express.Router();

const { signupController, signinController } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

/* ── Public routes (login দরকার নেই) ──────────────────── */
router.post('/register', signupController);
router.post('/signin',   signinController);

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

