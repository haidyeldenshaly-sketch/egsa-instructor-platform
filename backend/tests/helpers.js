process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/egsa_instructor_test';
process.env.JWT_ACCESS_SECRET = 'test-access'; process.env.JWT_REFRESH_SECRET = 'test-refresh';
process.env.INTEGRATION_API_KEY = 'test-integration-key';
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const app = require('../src/app');
const { seed } = require('../src/seed/seed');

let server, base, ctx;
async function start() {
  await connectDB();
  ctx = await seed({ reset: true, password: 'Instructor#Dev123' });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
  return ctx;
}
async function stop() { await new Promise((r) => server.close(r)); await mongoose.disconnect(); }
async function api(method, path, { token, body, key } = {}) {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key ? { 'x-api-key': key } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: json, data: json && json.data, meta: json && json.meta };
}
const login = async (email, password = 'Instructor#Dev123') => (await api('POST', '/auth/login', { body: { email, password } })).data;
module.exports = { start, stop, api, login, rawBase: async () => base, get ctx() { return ctx; }, KEY: 'test-integration-key' };
