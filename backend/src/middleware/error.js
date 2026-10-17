const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const notFound = (req, _res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl.split('?')[0]}`));
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500, message = err.message, details = err.details;
  if (err.name === 'ValidationError' && err.errors) { status = 400; message = 'Validation failed'; details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })); }
  else if (err.name === 'CastError') { status = 404; message = 'Resource not found'; }
  else if (err.code === 11000) { status = 409; message = 'Duplicate record'; }
  else if (err.type === 'entity.parse.failed') { status = 400; message = 'Malformed JSON body'; }
  else if (!err.isOperational && status === 500) { message = 'Internal server error'; }
  // Never log secrets/bodies. Log only server errors, message + stack in development.
  if (status >= 500) console.error('[error]', env.nodeEnv === 'production' ? err.message : err.stack);
  res.status(status).json({ success: false, error: { message, ...(details ? { details } : {}) } });
};
module.exports = { notFound, errorHandler };
