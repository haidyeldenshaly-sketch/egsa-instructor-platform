const { ActivityLog } = require('../models');
const log = (user, action, entityType, entityId, summary) =>
  ActivityLog.create({ user, action, entityType, entityId, summary }).catch(() => null);
module.exports = { log };
