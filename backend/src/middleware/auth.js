const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('../utils/helpers');
const { ACCOUNT_STATUS } = require('../config/constants');

// authenticate: identity ALWAYS comes from the verified JWT, never from request body/params/query.
const authenticate = asyncHandler(async (req, _res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw ApiError.unauthorized();
  let payload;
  try { payload = jwt.verify(h.slice(7), env.jwt.accessSecret); }
  catch { throw ApiError.unauthorized('Invalid or expired token'); }
  const user = await User.findById(payload.sub);
  if (!user || user.status !== ACCOUNT_STATUS.ACTIVE) throw ApiError.unauthorized('Account is not active');
  req.user = { id: user._id, role: user.role, name: user.name };
  next();
});

const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(ApiError.forbidden('Role not permitted for this resource'));

// Integration (service-to-service) key, used only by the future Student Project endpoints.
const requireApiKey = (req, _res, next) => {
  const key = req.headers['x-api-key'];
  if (!env.integrationApiKey || !key || key !== env.integrationApiKey) return next(ApiError.unauthorized('Invalid API key'));
  next();
};
module.exports = { authenticate, authorize, requireApiKey };
