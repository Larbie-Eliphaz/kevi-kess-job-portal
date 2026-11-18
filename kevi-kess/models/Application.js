const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  coverLetter: { type: String, trim: true, maxlength: 3000, default: '' },
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'shortlisted', 'interview', 'offer', 'rejected', 'withdrawn'],
    default: 'submitted',
    index: true
  }
}, { timestamps: true });

applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
