const crypto = require('crypto');
const Session = require('../models/Session');
const Account = require('../models/Account');

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
  await Session.create({ account: account._id, tokenHash: hashToken(token), expiresAt });
  setCookie(res, token);
}

async function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
    if (!session) {
      clearCookie(res);
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    const account = await Account.findById(session.account).select('_id email role fullName phone location skills experience companyName companyDescription companyWebsite');
    if (!account) {
      await Session.deleteOne({ _id: session._id });
      clearCookie(res);
      return res.status(401).json({ error: 'Account not found. Please sign in again.' });
    }
    req.account = account;
    req.sessionId = session._id;
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
