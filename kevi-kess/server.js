require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const adminAuth = require('./middleware/adminAuth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const marketplaceRoutes = require('./routes/marketplace');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kevi_kess';

const app = express();
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// CSP is off because the site uses inline scripts/styles.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));

// Admin sign-in uses a revocable, HttpOnly session cookie so the dashboard can sign out.
app.post('/api/admin/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin sign-in attempts. Please try again later.' }
}), adminAuth.login);
app.post('/api/admin/logout', adminAuth.logout);
app.use('/api/admin', adminAuth.requireAdmin, adminRoutes);
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'admin.html')));

// Account creation and login are rate limited separately from marketplace browsing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again later.' }
});
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api', marketplaceRoutes);

// Public form endpoints (rate limited to curb spam)
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, errors: ['Too many submissions. Please try again later.'] }
});
app.use('/api', formLimiter, publicRoutes);

app.get('/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});

app.get(['/portal', '/jobs'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'portal.html')));

// The website Homepage
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, errors: ['Invalid JSON.'] });
  if (err.code === 11000) return res.status(409).json({ error: 'This record already exists.' });
  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, errors: Object.values(err.errors).map((e) => e.message) });
  }
  console.error(err);
  res.status(500).json({ success: false, errors: ['Server error. Please try again.'] });
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected:', MONGODB_URI);
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB. Is mongod running?\n', err.message);
    process.exit(1);
  });
