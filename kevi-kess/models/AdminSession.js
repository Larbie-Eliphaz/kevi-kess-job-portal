const mongoose = require('mongoose');

const adminSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

module.exports = mongoose.model('AdminSession', adminSessionSchema);