const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { sha256 } = require('../utils/helpers');
const { ACCOUNT_STATUS } = require('../config/constants');

const signAccess = (u) => jwt.sign({ sub: String(u._id), role: u.role }, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpires });
const signRefresh = (u) => jwt.sign({ sub: String(u._id), jti: crypto.randomUUID() }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpires });
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const MAX_SESSIONS = 5;
// Each login/refresh adds one hashed refresh token; refresh ROTATES (replaces) the presented one.
// Multiple devices can stay signed in at once; the oldest session is dropped beyond MAX_SESSIONS.
async function issue(user, replaceHash) {
  const refreshToken = signRefresh(user);
  const list = (user.refreshTokenHashes || []).filter((h) => h !== replaceHash);
  list.push(sha256(refreshToken));
  await User.updateOne({ _id: user._id }, { refreshTokenHashes: list.slice(-MAX_SESSIONS) });
  return { accessToken: signAccess(user), refreshToken, user: user.toSafe() };
}
async function login(email, password) {
  const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+passwordHash +refreshTokenHashes');
  // constant-ish time compare even when user is unknown (no user enumeration)
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid) throw ApiError.unauthorized('Invalid email or password');
  if (user.status !== ACCOUNT_STATUS.ACTIVE) throw ApiError.forbidden('Account is not active');
  return issue(user);
}
async function refresh(token) {
  let p;
  try { p = jwt.verify(token, env.jwt.refreshSecret); } catch { throw ApiError.unauthorized('Invalid refresh token'); }
  const user = await User.findById(p.sub).select('+refreshTokenHashes');
  const h = sha256(token);
  if (!user || user.status !== ACCOUNT_STATUS.ACTIVE || !(user.refreshTokenHashes || []).includes(h)) throw ApiError.unauthorized('Invalid refresh token');
  return issue(user, h); // rotation: the presented token is invalidated
}
// Logout ends only the presented session; without a token it ends all sessions.
const logout = (userId, refreshToken) => User.updateOne({ _id: userId }, refreshToken ? { $pull: { refreshTokenHashes: sha256(refreshToken) } } : { $set: { refreshTokenHashes: [] } });

async function sendMail(to, subject, text) {
  if (!env.smtp.host) { if (env.nodeEnv !== 'production') console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}`); return; }
  const t = nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined });
  await t.sendMail({ from: env.smtp.from, to, subject, text });
}
async function forgotPassword(email) {
  const user = await User.findOne({ email: String(email).trim().toLowerCase() });
  if (user && user.status === ACCOUNT_STATUS.ACTIVE) {
    const raw = crypto.randomBytes(32).toString('hex');
    await User.updateOne({ _id: user._id }, { passwordResetHash: sha256(raw), passwordResetExpires: new Date(Date.now() + 30 * 60e3) });
    await sendMail(user.email, 'EGSA Instructor password reset', `Reset link: ${env.clientOrigin[0]}/reset-password?token=${raw}\nValid for 30 minutes.`);
    if (env.nodeEnv === 'test') return { _testToken: raw };
  }
  return {}; // identical response whether or not the account exists
}
async function resetPassword(token, password) {
  const user = await User.findOne({ passwordResetHash: sha256(token), passwordResetExpires: { $gt: new Date() } });
  if (!user) throw ApiError.badRequest('Reset token is invalid or has expired');
  await User.updateOne({ _id: user._id }, { passwordHash: await bcrypt.hash(password, 12), $unset: { passwordResetHash: 1, passwordResetExpires: 1 }, $set: { refreshTokenHashes: [] } });
}
module.exports = { login, refresh, logout, forgotPassword, resetPassword };
