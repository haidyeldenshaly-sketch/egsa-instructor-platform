const svc = require('../services/auth.service');
const profile = require('../services/profile.service');
const { asyncHandler, ok } = require('../utils/helpers');
exports.login = asyncHandler(async (req, res) => ok(res, await svc.login(req.body.email, req.body.password)));
exports.refresh = asyncHandler(async (req, res) => ok(res, await svc.refresh(req.body.refreshToken)));
exports.logout = asyncHandler(async (req, res) => { await svc.logout(req.user.id, req.body?.refreshToken); ok(res, { loggedOut: true }); });
exports.me = asyncHandler(async (req, res) => ok(res, await profile.get(req.user.id)));
exports.forgot = asyncHandler(async (req, res) => { const r = await svc.forgotPassword(req.body.email); ok(res, { message: 'If the account exists, a reset link has been sent.', ...(process.env.NODE_ENV === 'test' ? r : {}) }); });
exports.reset = asyncHandler(async (req, res) => { await svc.resetPassword(req.body.token, req.body.password); ok(res, { message: 'Password updated' }); });
