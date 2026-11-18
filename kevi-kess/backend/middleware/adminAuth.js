const crypto = require('crypto');
const { query } = require('../db');

const COOKIE_NAME = 'kk_admin_session';
const SESSION_HOURS = 8;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function clearCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function getToken(req) {
  const prefix = `${COOKIE_NAME}=`;
  const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return cookie ? cookie.slice(prefix.length) : '';
}

async function login(req, res, next) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) {
    return res.status(503).json({ error: 'Admin credentials are not configured on the server.' });
  }
  const body = req.body || {};
  const providedUser = typeof body.username === 'string' ? body.username : '';
  const providedPass = typeof body.password === 'string' ? body.password : '';
  const userHash = crypto.createHash('sha256').update(providedUser).digest();
  const expectedUserHash = crypto.createHash('sha256').update(user).digest();
  const passHash = crypto.createHash('sha256').update(providedPass).digest();
  const expectedPassHash = crypto.createHash('sha256').update(pass).digest();
  if (!crypto.timingSafeEqual(userHash, expectedUserHash) || !crypto.timingSafeEqual(passHash, expectedPassHash)) {
    return res.status(401).json({ error: 'Username or password is incorrect.' });
  }

  try {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
    await query(`
      INSERT INTO dbo.AdminSessions (TokenHash, ExpiresAt)
      VALUES (@tokenHash, @expiresAt)
    `, { tokenHash: hashToken(token), expiresAt });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.append('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 60 * 60}${secure}`);
    res.json({ success: true, expiresAt });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const token = getToken(req);
    if (token) {
      await query('DELETE FROM dbo.AdminSessions WHERE TokenHash = @tokenHash', {
        tokenHash: hashToken(token)
      });
    }
    clearCookie(res);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function requireAdmin(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Admin sign-in required.' });
    const result = await query(`
      SELECT TOP (1) Id AS _id
      FROM dbo.AdminSessions
      WHERE TokenHash = @tokenHash AND ExpiresAt > SYSUTCDATETIME()
    `, { tokenHash: hashToken(token) });
    const session = result.recordset[0];
    if (!session) {
      clearCookie(res);
      return res.status(401).json({ error: 'Admin session expired. Please sign in again.' });
    }
    req.adminSessionId = session._id;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, requireAdmin };
