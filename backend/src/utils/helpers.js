const crypto = require('crypto');
const ID_RE = /^[a-f\d]{24}$/i;
module.exports = {
  isId: (v) => typeof v === 'string' && ID_RE.test(v),
  asyncHandler: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
  sha256: (s) => crypto.createHash('sha256').update(s).digest('hex'),
  escapeRegex: (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  pick: (obj, keys) => keys.reduce((a, k) => (obj[k] !== undefined ? { ...a, [k]: obj[k] } : a), {}),
  pct: (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null),
  ok: (res, data, meta, status = 200) => res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) }),
};
