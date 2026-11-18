const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Notification = require('../models/Notification');
const Session = require('../models/Session');
const { clearCookie, createSession, getToken, hashToken, requireAuth, requireRole } = require('../middleware/accountAuth');

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s.-]{7,30}$/;
const JOB_TYPES = ['full-time', 'part-time', 'contract', 'temporary'];
const EMPLOYER_STATUSES = ['under_review', 'shortlisted', 'interview', 'offer', 'rejected'];
const str = (value) => typeof value === 'string' ? value.trim() : '';

function publicAccount(account) {
  const data = account.toObject ? account.toObject() : account;
  delete data.passwordHash;
  delete data.__v;
  return data;
}

async function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

async function passwordMatches(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function validateJob(body) {
  const job = {
    title: str(body.title),
    sector: str(body.sector),
    location: str(body.location),
    employmentType: str(body.employmentType),
    salary: str(body.salary),
    description: str(body.description),
    requirements: str(body.requirements)
  };
  const errors = [];
  if (!job.title) errors.push('Job title is required.');
  if (!Candidate.SECTORS.includes(job.sector)) errors.push('Choose a valid job sector.');
  if (!job.location) errors.push('Job location is required.');
  if (!JOB_TYPES.includes(job.employmentType)) errors.push('Choose a valid employment type.');
  if (!job.description) errors.push('Job description is required.');
  if (job.title.length > 160 || job.location.length > 160 || job.salary.length > 120 ||
      job.description.length > 5000 || job.requirements.length > 3000) {
    errors.push('One or more job fields exceed the allowed length.');
  }
  return { job, errors };
}

async function notify(account, message) {
  await Notification.create({ account, message, href: '/portal#applications' });
}

router.post('/auth/register', async (req, res, next) => {
  try {
    const body = req.body || {};
    const email = str(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const role = str(body.role);
    const errors = [];
    if (!EMAIL_RE.test(email) || email.length > 254) errors.push('Enter a valid email address.');
    if (password.length < 10 || password.length > 128) errors.push('Password must be between 10 and 128 characters.');
    if (!['candidate', 'employer'].includes(role)) errors.push('Choose candidate or employer account type.');

    const profile = {};
    if (role === 'candidate') {
      profile.fullName = str(body.fullName);
      profile.phone = str(body.phone);
      if (!profile.fullName) errors.push('Full name is required.');
      if (!PHONE_RE.test(profile.phone)) errors.push('Enter a valid phone number.');
    } else if (role === 'employer') {
      profile.companyName = str(body.companyName);
      profile.phone = str(body.phone);
      if (!profile.companyName) errors.push('Company name is required.');
      if (!PHONE_RE.test(profile.phone)) errors.push('Enter a valid phone number.');
    }
    if (errors.length) return res.status(400).json({ errors });

    const account = await Account.create({
      email, passwordHash: await passwordHash(password), role, ...profile
    });
    await createSession(account, res);
    res.status(201).json({ account: publicAccount(account) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'An account with that email already exists.' });
    next(err);
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const email = str(req.body && req.body.email).toLowerCase();
    const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
    const account = await Account.findOne({ email }).select('+passwordHash');
    if (!account || !(await passwordMatches(password, account.passwordHash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    await createSession(account, res);
    res.json({ account: publicAccount(account) });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/logout', async (req, res, next) => {
  try {
    const token = getToken(req);
    if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
    clearCookie(res);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/auth/me', requireAuth, (req, res) => res.json({ account: publicAccount(req.account) }));

router.patch('/auth/profile', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const account = req.account;
    const update = {};
    const errors = [];
    if (account.role === 'candidate') {
      if (body.fullName !== undefined) update.fullName = str(body.fullName);
      if (body.phone !== undefined) update.phone = str(body.phone);
      if (body.location !== undefined) update.location = str(body.location);
      if (body.skills !== undefined) update.skills = str(body.skills);
      if (body.experience !== undefined) update.experience = str(body.experience);
      if (update.fullName !== undefined && !update.fullName) errors.push('Full name is required.');
      if (update.phone !== undefined && !PHONE_RE.test(update.phone)) errors.push('Enter a valid phone number.');
    } else {
      if (body.companyName !== undefined) update.companyName = str(body.companyName);
      if (body.phone !== undefined) update.phone = str(body.phone);
      if (body.location !== undefined) update.location = str(body.location);
      if (body.companyDescription !== undefined) update.companyDescription = str(body.companyDescription);
      if (body.companyWebsite !== undefined) {
        update.companyWebsite = str(body.companyWebsite);
        if (update.companyWebsite) {
          try {
            const url = new URL(update.companyWebsite);
            if (!['http:', 'https:'].includes(url.protocol)) errors.push('Website must use http or https.');
          } catch {
            errors.push('Enter a valid website URL.');
          }
        }
      }
      if (update.companyName !== undefined && !update.companyName) errors.push('Company name is required.');
      if (update.phone !== undefined && !PHONE_RE.test(update.phone)) errors.push('Enter a valid phone number.');
    }
    if (errors.length) return res.status(400).json({ errors });
    if (!Object.keys(update).length) return res.status(400).json({ error: 'No profile fields to update.' });
    const updated = await Account.findByIdAndUpdate(account._id, update, { new: true, runValidators: true });
    res.json({ account: publicAccount(updated) });
  } catch (err) {
    next(err);
  }
});

router.patch('/auth/password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 10 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be between 10 and 128 characters.' });
    }
    const account = await Account.findById(req.account._id).select('+passwordHash');
    if (!account || !(await passwordMatches(currentPassword, account.passwordHash))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    account.passwordHash = await passwordHash(newPassword);
    await account.save();
    await Session.deleteMany({ account: account._id, _id: { $ne: req.sessionId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
    const filter = { status: 'open' };
    if (typeof req.query.sector === 'string' && Candidate.SECTORS.includes(req.query.sector)) {
      filter.sector = req.query.sector;
    }
    if (typeof req.query.type === 'string' && JOB_TYPES.includes(req.query.type)) {
      filter.employmentType = req.query.type;
    }
    const q = str(req.query.q);
    const location = str(req.query.location);
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: rx }, { description: rx }, { requirements: rx }, { sector: rx }];
    }
    if (location) filter.location = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [items, total] = await Promise.all([
      Job.find(filter).populate('employer', 'companyName location')
        .select('-requirements').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Job.countDocuments(filter)
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid job id.' });
    const job = await Job.findOne({ _id: req.params.id, status: 'open' })
      .populate('employer', 'companyName location companyDescription companyWebsite')
      .lean();
    if (!job) return res.status(404).json({ error: 'Job not found or no longer available.' });
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

router.post('/jobs/:id/applications', requireAuth, requireRole('candidate'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid job id.' });
    if (!req.account.fullName || !req.account.phone) {
      return res.status(400).json({ error: 'Complete your name and phone number in your profile before applying.' });
    }
    const job = await Job.findOne({ _id: req.params.id, status: 'open' });
    if (!job) return res.status(404).json({ error: 'Job not found or no longer available.' });
    const coverLetter = str(req.body && req.body.coverLetter);
    if (coverLetter.length > 3000) return res.status(400).json({ error: 'Cover letter must be 3000 characters or fewer.' });
    const application = await Application.create({
      job: job._id,
      candidate: req.account._id,
      employer: job.employer,
      coverLetter
    });
    await notify(job.employer, `${req.account.fullName} applied for ${job.title}.`);
    res.status(201).json({ application });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'You have already applied for this job.' });
    next(err);
  }
});

router.get('/candidate/applications', requireAuth, requireRole('candidate'), async (req, res, next) => {
  try {
    const items = await Application.find({ candidate: req.account._id })
      .populate({ path: 'job', select: 'title sector location employmentType salary status createdAt' })
      .sort({ createdAt: -1 }).lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.patch('/candidate/applications/:id', requireAuth, requireRole('candidate'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid application id.' });
    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, candidate: req.account._id, status: { $nin: ['withdrawn', 'rejected'] } },
      { status: 'withdrawn' },
      { new: true }
    );
    if (!application) return res.status(404).json({ error: 'Application not found or cannot be withdrawn.' });
    await notify(application.employer, `${req.account.fullName} withdrew an application.`);
    res.json({ application });
  } catch (err) {
    next(err);
  }
});

router.get('/employer/jobs', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    const items = await Job.find({ employer: req.account._id }).sort({ createdAt: -1 }).lean();
    const counts = await Application.aggregate([
      { $match: { employer: req.account._id, status: { $ne: 'withdrawn' } } },
      { $group: { _id: '$job', count: { $sum: 1 } } }
    ]);
    const countByJob = new Map(counts.map((row) => [String(row._id), row.count]));
    res.json({ items: items.map((job) => ({ ...job, applicationCount: countByJob.get(String(job._id)) || 0 })) });
  } catch (err) {
    next(err);
  }
});

router.post('/employer/jobs', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    if (!req.account.companyName || !req.account.phone) {
      return res.status(400).json({ error: 'Complete your company name and phone number in your profile before posting a job.' });
    }
    const { job, errors } = validateJob(req.body || {});
    if (errors.length) return res.status(400).json({ errors });
    const saved = await Job.create({ ...job, employer: req.account._id });
    res.status(201).json({ job: saved });
  } catch (err) {
    next(err);
  }
});

router.patch('/employer/jobs/:id', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid job id.' });
    const job = await Job.findOne({ _id: req.params.id, employer: req.account._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    const body = req.body || {};
    if (body.status !== undefined) {
      if (!['open', 'closed'].includes(body.status)) return res.status(400).json({ error: 'Choose open or closed status.' });
      job.status = body.status;
    }
    const fields = ['title', 'sector', 'location', 'employmentType', 'salary', 'description', 'requirements'];
    if (fields.some((field) => body[field] !== undefined)) {
      const { job: values, errors } = validateJob({ ...job.toObject(), ...body });
      if (errors.length) return res.status(400).json({ errors });
      fields.forEach((field) => { if (body[field] !== undefined) job[field] = values[field]; });
    }
    await job.save();
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

router.delete('/employer/jobs/:id', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid job id.' });
    const job = await Job.findOne({ _id: req.params.id, employer: req.account._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    if (await Application.exists({ job: job._id })) {
      return res.status(409).json({ error: 'This job has applications. Close it instead to preserve its records.' });
    }
    await job.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/employer/jobs/:jobId/applications', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.jobId)) return res.status(400).json({ error: 'Invalid job id.' });
    const ownsJob = await Job.exists({ _id: req.params.jobId, employer: req.account._id });
    if (!ownsJob) return res.status(404).json({ error: 'Job not found.' });
    const items = await Application.find({ job: req.params.jobId, status: { $ne: 'withdrawn' } })
      .populate('candidate', 'fullName email phone location skills experience')
      .sort({ createdAt: -1 }).lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.patch('/employer/applications/:id', requireAuth, requireRole('employer'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid application id.' });
    const status = str(req.body && req.body.status);
    if (!EMPLOYER_STATUSES.includes(status)) return res.status(400).json({ error: 'Choose a valid applicant status.' });
    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, employer: req.account._id, status: { $ne: 'withdrawn' } },
      { status },
      { new: true }
    ).populate('job', 'title');
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    await notify(application.candidate, `Your application for ${application.job.title} is now ${status.replace('_', ' ')}.`);
    res.json({ application });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const items = await Notification.find({ account: req.account._id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ items, unread: items.filter((item) => !item.readAt).length });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid notification id.' });
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.id, account: req.account._id },
      { readAt: new Date() },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Notification not found.' });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
