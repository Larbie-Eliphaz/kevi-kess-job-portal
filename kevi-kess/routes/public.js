const express = require('express');
const Candidate = require('../models/Candidate');
const Employer = require('../models/Employer');

const router = express.Router();

// Force any incoming value to a trimmed string (also blocks NoSQL operator objects like {$gt:""}).
const str = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
const PHONE_RE = /^[+()\d\s.-]{7,30}$/;

const meta = (req) => ({ ip: req.ip, userAgent: (req.get('user-agent') || '').slice(0, 300) });

router.post('/candidates', async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = {
      name: str(b.name),
      phone: str(b.phone),
      role: str(b.role),
      experience: str(b.experience)
    };
    const errors = [];
    if (!doc.name) errors.push('Full name is required.');
    if (!PHONE_RE.test(doc.phone)) errors.push('A valid phone number is required.');
    if (!Candidate.SECTORS.includes(doc.role)) errors.push('Please choose a valid sector.');
    if (errors.length) return res.status(400).json({ success: false, errors });

    const saved = await Candidate.create({ ...doc, meta: meta(req) });
    res.status(201).json({ success: true, id: saved._id });
  } catch (err) { next(err); }
});

router.post('/employers', async (req, res, next) => {
  try {
    const b = req.body || {};
    const countRaw = str(b.count);
    const doc = {
      company: str(b.company),
      phone: str(b.phone),
      role: str(b.role),
      count: countRaw ? Number(countRaw) : null,
      details: str(b.details)
    };
    const errors = [];
    if (!doc.company) errors.push('Company / contact name is required.');
    if (!PHONE_RE.test(doc.phone)) errors.push('A valid phone number is required.');
    if (!doc.role) errors.push('Worker type / job role is required.');
    if (doc.count !== null && (!Number.isInteger(doc.count) || doc.count < 1)) {
      errors.push('Number of workers must be a whole number of at least 1.');
    }
    if (errors.length) return res.status(400).json({ success: false, errors });

    const saved = await Employer.create({ ...doc, meta: meta(req) });
    res.status(201).json({ success: true, id: saved._id });
  } catch (err) { next(err); }
});

module.exports = router;
