const mongoose = require('mongoose');
const Candidate = require('./Candidate');

const jobSchema = new mongoose.Schema({
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  sector: { type: String, required: true, enum: Candidate.SECTORS },
  location: { type: String, required: true, trim: true, maxlength: 160 },
  employmentType: { type: String, required: true, enum: ['full-time', 'part-time', 'contract', 'temporary'] },
  salary: { type: String, trim: true, maxlength: 120, default: '' },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  requirements: { type: String, trim: true, maxlength: 3000, default: '' },
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true }
}, { timestamps: true });

jobSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);
