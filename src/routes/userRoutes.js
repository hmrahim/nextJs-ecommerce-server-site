// 📁 PATH: src/routes/userRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getMe, updateMe, updateAvatar, changePassword, addAddress, updateAddress, deleteAddress, setDefaultAddress, deleteCard, getActivity, requestDeletion, updateNotifications } = require('../controllers/userController');


// সব route-এ login লাগবে


// ── Profile ───────────────────────────────────────────────
router.get('/users/me', protect, getMe);
router.patch('/users/me', protect, updateMe);
router.patch('/users/me/avatar', protect, updateAvatar);    // { avatarUrl } body
router.patch('/users/me/password', protect, changePassword);

// ── Addresses ─────────────────────────────────────────────
router.post('/users/me/addresses', protect, addAddress);
router.patch('/users/me/addresses/:addressId', protect, updateAddress);
router.delete('/users/me/addresses/:addressId', protect, deleteAddress);
router.patch('/users/me/addresses/:addressId/default', protect, setDefaultAddress);

// ── Cards ─────────────────────────────────────────────────
router.delete('/users/me/cards/:cardType', protect, deleteCard);

// ── Misc ──────────────────────────────────────────────────
router.get('/users/me/activity', protect, getActivity);
router.post('/users/me/delete-request', protect, requestDeletion);
router.patch('/users/me/notifications', protect, updateNotifications);

module.exports = router;
