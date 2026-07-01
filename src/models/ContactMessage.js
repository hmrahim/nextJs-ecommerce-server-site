// 📁 PATH: models/ContactMessage.js

const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    message:    { type: String, required: true, trim: true },
    repliedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    repliedByName: { type: String },
    repliedAt:  { type: Date, default: Date.now },
  },
  { _id: false }
);

const contactMessageSchema = new mongoose.Schema(
  {
    name:    { type: String, required: [true, 'Name is required'], trim: true },
    email:   { type: String, required: [true, 'Email is required'], trim: true, lowercase: true },
    phone:   { type: String, trim: true },
    subject: { type: String, trim: true, default: 'General inquiry' },
    message: { type: String, required: [true, 'Message is required'], trim: true },
    status:  { type: String, enum: ['new', 'read', 'replied'], default: 'new' },
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ContactMessage', contactMessageSchema);