const express = require('express');
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const Employer = require('../models/Employer');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Account = require('../models/Account');

const router = express.Router();

function crud(path, Model) {
  const statuses = Model.schema.path('status').enumValues;

  // List with optional ?status=&q=&page=&limit=
  router.get(`/${path}`, async (req, res, next) => {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
      const filter = {};
      if (typeof req.query.status === 'string' && statuses.includes(req.query.status)) {
        filter.status = req.query.status;
      }
      if (typeof req.query.q === 'string' && req.query.q.trim()) {
        const rx = new RegExp(req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = Object.keys(Model.schema.paths)
          .filter((k) => Model.schema.paths[k].instance === 'String' && !['status', '_id', '__v'].includes(k))
          .map((k) => ({ [k]: rx }));
      }
      const [items, total] = await Promise.all([
        Model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Model.countDocuments(filter)
      ]);
      res.json({ items, total, page, pages: Math.ceil(total / limit), statuses });
    } catch (err) { next(err); }
  });

  // Update status / notes
  router.patch(`/${path}/:id`, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
      const update = {};
      if (typeof req.body.status === 'string' && statuses.includes(req.body.status)) update.status = req.body.status;
      if (typeof req.body.notes === 'string') update.notes = req.body.notes.slice(0, 2000);
      if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update.' });
      const doc = await Model.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found.' });
      res.json(doc);
    } catch (err) { next(err); }
  });

  router.delete(`/${path}/:id`, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found.' });
      res.json({ success: true });
    } catch (err) { next(err); }
  });
}

crud('candidates', Candidate);
crud('employers', Employer);

router.get('/accounts', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const filter = {};
    if (typeof req.query.role === 'string' && ['candidate', 'employer'].includes(req.query.role)) {
      filter.role = req.query.role;
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const rx = new RegExp(req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = ['email', 'fullName', 'companyName', 'phone', 'location'].map((field) => ({ [field]: rx }));
    }
    const [items, total] = await Promise.all([
      Account.find(filter).select('email role fullName phone location companyName createdAt')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Account.countDocuments(filter)
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const filter = {};
    if (typeof req.query.status === 'string' && ['open', 'closed'].includes(req.query.status)) filter.status = req.query.status;
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const rx = new RegExp(req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = ['title', 'sector', 'location', 'description'].map((field) => ({ [field]: rx }));
    }
    const [items, total] = await Promise.all([
      Job.find(filter).populate('employer', 'companyName email').sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      Job.countDocuments(filter)
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit), statuses: Job.schema.path('status').enumValues });
  } catch (err) { next(err); }
});

router.patch('/jobs/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const status = req.body && req.body.status;
    if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'Choose open or closed status.' });
    const job = await Job.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true }).lean();
    if (!job) return res.status(404).json({ error: 'Not found.' });
    res.json(job);
  } catch (err) { next(err); }
});

router.get('/applications', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const filter = {};
    const statuses = Application.schema.path('status').enumValues;
    if (typeof req.query.status === 'string' && statuses.includes(req.query.status)) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      Application.find(filter).populate('job', 'title').populate('candidate', 'email fullName')
        .populate('employer', 'email companyName').sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      Application.countDocuments(filter)
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit), statuses });
  } catch (err) { next(err); }
});

router.patch('/applications/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const status = req.body && req.body.status;
    if (!Application.schema.path('status').enumValues.includes(status)) {
      return res.status(400).json({ error: 'Choose a valid application status.' });
    }
    const application = await Application.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true }).lean();
    if (!application) return res.status(404).json({ error: 'Not found.' });
    res.json(application);
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [candidates, employers, newCandidates, newEmployers, candidateAccounts, employerAccounts, jobs, openJobs, applications] = await Promise.all([
      Candidate.countDocuments(), Employer.countDocuments(),
      Candidate.countDocuments({ status: 'new' }), Employer.countDocuments({ status: 'new' }),
      Account.countDocuments({ role: 'candidate' }), Account.countDocuments({ role: 'employer' }),
      Job.countDocuments(), Job.countDocuments({ status: 'open' }), Application.countDocuments()
    ]);
    res.json({ candidates, employers, newCandidates, newEmployers, candidateAccounts, employerAccounts, jobs, openJobs, applications });
  } catch (err) { next(err); }
});

module.exports = router;
