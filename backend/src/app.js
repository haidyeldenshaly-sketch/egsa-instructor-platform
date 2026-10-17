const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const path = require('path');
const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev')); // method/url/status only; no bodies
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));
if (!env.rateLimitDisabled) app.use('/api', rateLimit({ windowMs: 60e3, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);
module.exports = app;
