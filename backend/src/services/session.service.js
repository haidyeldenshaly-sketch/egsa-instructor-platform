const { Session, Cohort, Attendance } = require('../models');
const { SESSION_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { pick } = require('../utils/helpers');
const { ownedCohort, ownedCohortIds, ownedSession } = require('./ownership.service');
const activity = require('./activity.service');

async function list(instructorId, { cohortId, status, upcoming, page = 1, limit = 50 }) {
  let ids = await ownedCohortIds(instructorId);
  if (cohortId) { await ownedCohort(instructorId, cohortId); ids = [cohortId]; }
  const q = { cohort: { $in: ids }, ...(status ? { status } : {}), ...(upcoming === 'true' ? { startsAt: { $gte: new Date() }, status: SESSION_STATUS.SCHEDULED } : {}) };
  const [items, total] = await Promise.all([
    Session.find(q).populate('course', 'name code').populate('cohort', 'name').sort({ startsAt: upcoming === 'true' ? 1 : -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Session.countDocuments(q)]);
  return { items, meta: { page, limit, total } };
}
async function get(instructorId, id) {
  const s = await ownedSession(instructorId, id);
  await s.populate([{ path: 'course', select: 'name code' }, { path: 'cohort', select: 'name' }]);
  const counts = await Attendance.find({ session: s._id }).select('status').lean();
  const tally = counts.reduce((m, a) => ({ ...m, [a.status]: (m[a.status] || 0) + 1 }), {});
  return { ...s.toObject(), attendanceSummary: tally };
}
const FIELDS = ['title', 'description', 'date', 'startTime', 'endTime', 'location', 'onlineUrl'];
async function create(instructorId, body) {
  const cohort = await ownedCohort(instructorId, body.cohortId);
  const s = await Session.create({ ...pick(body, FIELDS), cohort: cohort._id, course: cohort.course });
  await activity.log(instructorId, 'session.created', 'Session', s._id, `Created session "${s.title}"`);
  return s;
}
async function update(instructorId, id, body) {
  const s = await ownedSession(instructorId, id);
  if (s.status === SESSION_STATUS.CANCELLED) throw ApiError.conflict('A cancelled session cannot be modified');
  Object.assign(s, pick(body, [...FIELDS, 'status']));
  await s.save();
  await activity.log(instructorId, 'session.updated', 'Session', s._id, `Updated session "${s.title}"${body.status ? ` (${body.status})` : ''}`);
  return s;
}
module.exports = { list, get, create, update };
