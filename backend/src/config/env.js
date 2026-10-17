const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();
const bool = (v, d) => (v === undefined ? d : String(v).toLowerCase() === 'true');
module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5100,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/egsa_instructor',
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  integrationApiKey: process.env.INTEGRATION_API_KEY,
  smtp: { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.MAIL_FROM || 'no-reply@egsa.example' },
  rateLimitDisabled: bool(process.env.RATE_LIMIT_DISABLED, false),
};
