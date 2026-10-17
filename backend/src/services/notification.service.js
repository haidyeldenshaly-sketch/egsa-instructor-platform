const { Notification, Session, Assessment } = require('../models');
const { NOTIFICATION_TYPE, SESSION_STATUS, ASSESSMENT_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { isId } = require('../utils/helpers');
const { ownedCohortIds } = require('./ownership.service');

async function notify(user, { type = NOTIFICATION_TYPE.SYSTEM, title, message, link, dedupeKey }) {
  if (dedupeKey && (await Notification.exists({ user, dedupeKey }))) return null;
  return Notification.create({ user, type, title, message, link, dedupeKey });
}
// Idempotent reminders (deduped) for sessions in next 24h and assessments due in next 48h.
async function generateReminders(instructorId) {
  const ids = await ownedCohortIds(instructorId);
  if (!ids.length) return;
  const now = new Date();
  const sessions = await Session.find({ cohort: { $in: ids }, status: SESSION_STATUS.SCHEDULED, startsAt: { $gte: now, $lte: new Date(+now + 24 * 3600e3) } }).lean();
  for (const s of sessions) await notify(instructorId, { type: NOTIFICATION_TYPE.UPCOMING_SESSION, title: 'Upcoming session', message: `${s.title} starts at ${s.startTime}`, link: `/instructor/sessions/${s._id}`, dedupeKey: `session:${s._id}` });
  const due = await Assessment.find({ cohort: { $in: ids }, status: ASSESSMENT_STATUS.PUBLISHED, dueDate: { $gte: now, $lte: new Date(+now + 48 * 3600e3) } }).lean();
  for (const a of due) await notify(instructorId, { type: NOTIFICATION_TYPE.ASSESSMENT_DEADLINE, title: 'Assessment deadline approaching', message: a.title, link: `/instructor/assessments/${a._id}`, dedupeKey: `due:${a._id}` });
}
async function list(instructorId, { unread, page = 1, limit = 20 }) {
  await generateReminders(instructorId);
  const q = { user: instructorId, ...(unread === 'true' ? { read: false } : {}) };
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(q), Notification.countDocuments({ user: instructorId, read: false })]);
  return { items, meta: { page, limit, total, unreadCount } };
}
async function markRead(instructorId, id) {
  if (!isId(id)) throw ApiError.notFound();
  const n = await Notification.findOneAndUpdate({ _id: id, user: instructorId }, { read: true, readAt: new Date() }, { new: true });
  if (!n) throw ApiError.notFound();
  return n;
}
const markAllRead = (instructorId) => Notification.updateMany({ user: instructorId, read: false }, { read: true, readAt: new Date() });
module.exports = { notify, generateReminders, list, markRead, markAllRead };
