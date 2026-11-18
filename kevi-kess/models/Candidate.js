const mongoose = require('mongoose');

const SECTORS = [
  'Construction & Engineering', 'Healthcare & Support', 'Hospitality & Tourism',
  'Transportation & Logistics', 'Agriculture & Farming', 'Office & Administration',
  'Manufacturing & Production', 'Retail & Sales', 'Security', 'Other'
];

const candidateSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true, maxlength: 120 },
  phone:      { type: String, required: true, trim: true, maxlength: 30 },
  role:       { type: String, required: true, enum: SECTORS },
  experience: { type: String, trim: true, maxlength: 2000, default: '' },
  status:     { type: String, enum: ['new', 'contacted', 'shortlisted', 'placed', 'rejected'], default: 'new', index: true },
  notes:      { type: String, trim: true, maxlength: 2000, default: '' },
  meta:       { ip: String, userAgent: String }
}, { timestamps: true });

candidateSchema.index({ createdAt: -1 });

const Candidate = mongoose.model('Candidate', candidateSchema);
Candidate.SECTORS = SECTORS;
module.exports = Candidate;
