const mongoose = require('mongoose');

const employerSchema = new mongoose.Schema({
  company: { type: String, required: true, trim: true, maxlength: 160 },
  phone:   { type: String, required: true, trim: true, maxlength: 30 },
  role:    { type: String, required: true, trim: true, maxlength: 200 },
  count:   { type: Number, min: 1, max: 100000, default: null },
  details: { type: String, trim: true, maxlength: 3000, default: '' },
  status:  { type: String, enum: ['new', 'contacted', 'in-progress', 'filled', 'closed'], default: 'new', index: true },
  notes:   { type: String, trim: true, maxlength: 2000, default: '' },
  meta:    { ip: String, userAgent: String }
}, { timestamps: true });

employerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Employer', employerSchema);
