const express = require('express');
const { query } = require('../db');
const { SECTORS } = require('../constants');

const router = express.Router();

const str = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
const PHONE_RE = /^[+()\d\s.-]{7,30}$/;

const metadata = (req) => ({
  ip: req.ip,
  userAgent: (req.get('user-agent') || '').slice(0, 300)
});

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
    if (doc.name.length > 120) errors.push('Full name must be 120 characters or fewer.');
    if (!PHONE_RE.test(doc.phone)) errors.push('A valid phone number is required.');
    if (!SECTORS.includes(doc.role)) errors.push('Please choose a valid sector.');
    if (doc.experience.length > 2000) errors.push('Experience must be 2000 characters or fewer.');
    if (errors.length) return res.status(400).json({ success: false, errors });

    const saved = await query(`
      INSERT INTO dbo.Candidates (Name, Phone, Role, Experience, Ip, UserAgent)
      OUTPUT INSERTED.Id AS id
      VALUES (@name, @phone, @role, @experience, @ip, @userAgent)
    `, { ...doc, ...metadata(req) });
    res.status(201).json({ success: true, id: saved.recordset[0].id });
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
    if (doc.company.length > 160) errors.push('Company / contact name must be 160 characters or fewer.');
    if (!PHONE_RE.test(doc.phone)) errors.push('A valid phone number is required.');
    if (!doc.role) errors.push('Worker type / job role is required.');
    if (doc.role.length > 200) errors.push('Worker type / job role must be 200 characters or fewer.');
    if (doc.details.length > 3000) errors.push('Requirements must be 3000 characters or fewer.');
    if (doc.count !== null && (!Number.isInteger(doc.count) || doc.count < 1 || doc.count > 100000)) {
      errors.push('Number of workers must be a whole number between 1 and 100000.');
    }
    if (errors.length) return res.status(400).json({ success: false, errors });

    const saved = await query(`
      INSERT INTO dbo.Employers (Company, Phone, Role, [Count], Details, Ip, UserAgent)
      OUTPUT INSERTED.Id AS id
      VALUES (@company, @phone, @role, @count, @details, @ip, @userAgent)
    `, { ...doc, ...metadata(req) });
    res.status(201).json({ success: true, id: saved.recordset[0].id });
  } catch (err) { next(err); }
});

module.exports = router;
