const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  message: { type: String, required: true, trim: true, maxlength: 240 },
  href: { type: String, required: true, maxlength: 200 },
  readAt: { type: Date, default: null }
}, { timestamps: true });

notificationSchema.index({ account: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
