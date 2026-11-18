const SECTORS = [
  'Construction & Engineering', 'Healthcare & Support', 'Hospitality & Tourism',
  'Transportation & Logistics', 'Agriculture & Farming', 'Office & Administration',
  'Manufacturing & Production', 'Retail & Sales', 'Security', 'Other'
];

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'temporary'];
const APPLICATION_STATUSES = ['submitted', 'under_review', 'shortlisted', 'interview', 'offer', 'rejected', 'withdrawn'];
const EMPLOYER_APPLICATION_STATUSES = ['under_review', 'shortlisted', 'interview', 'offer', 'rejected'];
const JOB_STATUSES = ['open', 'closed'];
const CANDIDATE_STATUSES = ['new', 'contacted', 'shortlisted', 'placed', 'rejected'];
const EMPLOYER_STATUSES = ['new', 'contacted', 'in-progress', 'filled', 'closed'];

module.exports = {
  SECTORS,
  JOB_TYPES,
  APPLICATION_STATUSES,
  EMPLOYER_APPLICATION_STATUSES,
  JOB_STATUSES,
  CANDIDATE_STATUSES,
  EMPLOYER_STATUSES
};
