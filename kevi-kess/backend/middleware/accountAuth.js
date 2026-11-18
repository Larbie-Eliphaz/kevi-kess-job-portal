const crypto = require('crypto');
const { query } = require('../db');

const COOKIE_NAME = 'kk_session';
const SESSION_DAYS = 7;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function getToken(req) {
  const cookies = (req.headers.cookie || '').split(';');
  const value = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return value ? value.slice(COOKIE_NAME.length + 1) : '';
}

function setCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}

function clearCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

async function createSession(account, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await query(`
    INSERT INTO dbo.Sessions (AccountId, TokenHash, ExpiresAt)
    VALUES (@accountId, @tokenHash, @expiresAt)
  `, { accountId: account._id, tokenHash: hashToken(token), expiresAt });
  setCookie(res, token);
}

async function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    const result = await query(`
      SELECT TOP (1) s.Id AS sessionId, a.Id AS _id, a.Email AS email, a.Role AS role,
        a.FullName AS fullName, a.Phone AS phone, a.Location AS location,
        a.Skills AS skills, a.Experience AS experience, a.CompanyName AS companyName,
        a.CompanyDescription AS companyDescription, a.CompanyWebsite AS companyWebsite
      FROM dbo.Sessions s
      INNER JOIN dbo.Accounts a ON a.Id = s.AccountId
      WHERE s.TokenHash = @tokenHash AND s.ExpiresAt > SYSUTCDATETIME()
    `, { tokenHash: hashToken(token) });
    const session = result.recordset[0];
    if (!session) {
      clearCookie(res);
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    const { sessionId, ...account } = session;
    req.account = account;
    req.sessionId = sessionId;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.account || req.account.role !== role) {
      return res.status(403).json({ error: `A ${role} account is required for this action.` });
    }
    next();
  };
}

module.exports = { createSession, clearCookie, getToken, hashToken, requireAuth, requireRole };
