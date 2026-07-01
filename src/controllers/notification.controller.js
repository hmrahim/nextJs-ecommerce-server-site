// 📁 PATH: src/controllers/notification.controller.js
'use strict';

const Notification = require('../models/Notification.model');
const User = require('../models/User');
const { emitChange } = require('../utils/socket');

// Helper to create notifications for all admins
exports.createAdminNotification = async ({ type, title, message, data = {} }) => {
  try {
    const admins = await User.find({ role: 'admin' });
    const promises = admins.map(admin => {
      return Notification.create({
        userId: admin._id,
        type,
        title,
        message,
        data
      });
    });
    await Promise.all(promises);
  } catch (err) {
    console.error('Failed to create admin notification:', err);
  }
};

// GET /admin/notifications - Get all notifications for current admin user
exports.getAdminNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
      
    return res.status(200).json({
      success: true,
      notifications
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/notifications/mark-read - Mark all notifications as read
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    
    // Emit socket change to reload
    emitChange('Notification', 'update', { userId: req.user._id });
    
    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/notifications/:id/mark-read - Mark single notification as read
exports.markOneRead = async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    emitChange('Notification', 'update', { id: notif._id });
    
    return res.status(200).json({
      success: true,
      notification: notif
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /admin/notifications/clear - Delete all notifications
exports.clearAll = async (req, res, next) => {
  try {
    await Notification.deleteMany({ userId: req.user._id });
    
    emitChange('Notification', 'delete', { userId: req.user._id });
    
    return res.status(200).json({
      success: true,
      message: 'All notifications cleared'
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /admin/notifications/:id - Delete single notification
exports.deleteOne = async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    emitChange('Notification', 'delete', { id: req.params.id });
    
    return res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (err) {
    next(err);
  }
};
