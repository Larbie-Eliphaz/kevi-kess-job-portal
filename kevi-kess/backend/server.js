const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { query, initializeSchema } = require('./db');

const adminAuth = require('./middleware/adminAuth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const marketplaceRoutes = require('./routes/marketplace');

const PORT = process.env.PORT || 3000;

const app = express();
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

app.use(helmet());
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

app.get('/health', async (req, res, next) => {
  try {
    await query('SELECT 1 AS connected');
    res.json({ ok: true, db: true });
  } catch (err) {
    next(err);
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, errors: ['Invalid JSON.'] });
  if ([2601, 2627].includes(err.number)) return res.status(409).json({ error: 'This record already exists.' });
  console.error(err);
  res.status(500).json({ success: false, errors: ['Server error. Please try again.'] });
});

const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(503).send('Frontend is not built. Run npm run build first.');
  });
});

initializeSchema()
  .then(() => {
    console.log(`SQL Server connected: ${process.env.SQL_SERVER || 'localhost'}/${process.env.SQL_DATABASE || 'kevi_kess'}`);
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to SQL Server or initialize the database schema.\n', err);
    process.exit(1);
  });
