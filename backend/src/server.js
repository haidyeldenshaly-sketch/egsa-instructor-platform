const env = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');
(async () => {
  if (!env.jwt.accessSecret || !env.jwt.refreshSecret) { console.error('JWT secrets are not configured (see .env.example)'); process.exit(1); }
  await connectDB();
  console.log('MongoDB connected');
  app.listen(env.port, () => console.log(`EGSA Instructor API listening on :${env.port}`));
})().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
