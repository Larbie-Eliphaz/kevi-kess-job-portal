const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['candidate', 'employer'], required: true, index: true },
  fullName: { type: String, trim: true, maxlength: 120, default: '' },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  location: { type: String, trim: true, maxlength: 160, default: '' },
  skills: { type: String, trim: true, maxlength: 2000, default: '' },
  experience: { type: String, trim: true, maxlength: 3000, default: '' },
  companyName: { type: String, trim: true, maxlength: 160, default: '' },
  companyDescription: { type: String, trim: true, maxlength: 3000, default: '' },
  companyWebsite: { type: String, trim: true, maxlength: 300, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
