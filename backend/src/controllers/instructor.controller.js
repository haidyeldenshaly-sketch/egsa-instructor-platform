// Thin controllers: instructorId is ALWAYS req.user.id (from JWT); never read from params/body/query.
const { asyncHandler: h, ok } = require('../utils/helpers');
const S = {
  dashboard: require('../services/dashboard.service'), academic: require('../services/academic.service'),
  session: require('../services/session.service'), student: require('../services/student.service'),
  attendance: require('../services/attendance.service'), assessment: require('../services/assessment.service'),
  progress: require('../services/progress.service'),
  notification: require('../services/notification.service'), profile: require('../services/profile.service'),
  messaging: require('../services/messaging.service'),
};
const { ownedCohort } = require('../services/ownership.service');
const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };
const pg = (q) => ({ ...q, page: num(q.page, 1), limit: Math.min(num(q.limit, 20), 100) });
const me = (req) => req.user.id;

exports.dashboard = h(async (req, res) => ok(res, await S.dashboard.get(me(req))));
exports.courses = h(async (req, res) => ok(res, await S.academic.listCourses(me(req))));
exports.course = h(async (req, res) => ok(res, await S.academic.getCourse(me(req), req.params.id)));
exports.cohorts = h(async (req, res) => ok(res, await S.academic.listCohorts(me(req), req.query)));
exports.cohort = h(async (req, res) => ok(res, await S.academic.getCohort(me(req), req.params.id)));
exports.cohortStudents = h(async (req, res) => ok(res, await S.student.list(me(req), { cohortId: req.params.id, search: req.query.search })));
exports.cohortSessions = h(async (req, res) => { const r = await S.session.list(me(req), { cohortId: req.params.id, limit: 100 }); ok(res, r.items, r.meta); });
exports.cohortAttendance = h(async (req, res) => ok(res, await S.attendance.cohortSummary(me(req), req.params.id)));
exports.cohortAssessments = h(async (req, res) => ok(res, await S.assessment.list(me(req), { cohortId: req.params.id })));
exports.cohortProgress = h(async (req, res) => { await ownedCohort(me(req), req.params.id); ok(res, await S.progress.cohortProgress(req.params.id)); });

exports.sessions = h(async (req, res) => { const r = await S.session.list(me(req), pg(req.query)); ok(res, r.items, r.meta); });
exports.session = h(async (req, res) => ok(res, await S.session.get(me(req), req.params.id)));
exports.createSession = h(async (req, res) => ok(res, await S.session.create(me(req), req.body), null, 201));
exports.updateSession = h(async (req, res) => ok(res, await S.session.update(me(req), req.params.id, req.body)));

exports.students = h(async (req, res) => ok(res, await S.student.list(me(req), req.query)));
exports.student = h(async (req, res) => ok(res, await S.student.profile(me(req), req.params.id)));

exports.roster = h(async (req, res) => ok(res, await S.attendance.sessionRoster(me(req), req.params.sessionId)));
exports.saveAttendance = h(async (req, res) => ok(res, await S.attendance.saveAttendance(me(req), req.params.sessionId, req.body.records)));
exports.attendanceSummary = h(async (req, res) => ok(res, await S.attendance.cohortSummary(me(req), req.params.cohortId)));

exports.assessments = h(async (req, res) => ok(res, await S.assessment.list(me(req), req.query)));
exports.createAssessment = h(async (req, res) => ok(res, await S.assessment.create(me(req), req.body), null, 201));
exports.assessment = h(async (req, res) => ok(res, await S.assessment.get(me(req), req.params.id)));
exports.updateAssessment = h(async (req, res) => ok(res, await S.assessment.update(me(req), req.params.id, req.body)));
exports.publishAssessment = h(async (req, res) => ok(res, await S.assessment.publish(me(req), req.params.id)));
exports.deleteAssessment = h(async (req, res) => { await S.assessment.remove(me(req), req.params.id); ok(res, { deleted: true }); });
exports.assessmentSubmissions = h(async (req, res) => ok(res, await S.assessment.listSubmissions(me(req), { ...req.query, assessmentId: req.params.id })));

exports.submissions = h(async (req, res) => ok(res, await S.assessment.listSubmissions(me(req), req.query)));
exports.submission = h(async (req, res) => ok(res, await S.assessment.getSubmission(me(req), req.params.id)));
exports.grade = h(async (req, res) => ok(res, await S.assessment.grade(me(req), req.params.id, req.body)));
exports.publishResult = h(async (req, res) => ok(res, await S.assessment.publishResult(me(req), req.params.id)));

exports.progress = h(async (req, res) => ok(res, await S.student.list(me(req), req.query)));

exports.notifications = h(async (req, res) => { const r = await S.notification.list(me(req), pg(req.query)); ok(res, r.items, r.meta); });
exports.readNotification = h(async (req, res) => ok(res, await S.notification.markRead(me(req), req.params.id)));
exports.readAll = h(async (req, res) => { await S.notification.markAllRead(me(req)); ok(res, { updated: true }); });

exports.profile = h(async (req, res) => ok(res, await S.profile.get(me(req))));
exports.updateProfile = h(async (req, res) => ok(res, await S.profile.update(me(req), req.body)));
exports.changePassword = h(async (req, res) => { await S.profile.changePassword(me(req), req.body); ok(res, { message: 'Password changed' }); });

exports.uploadFile = h(async (req, res) => {
  const ApiError = require('../utils/ApiError');
  if (!req.file) throw ApiError.badRequest('No file provided');
  const url = `/uploads/assignments/${req.file.filename}`;
  ok(res, { name: req.file.originalname, url, size: req.file.size, mimetype: req.file.mimetype }, null, 201);
});
exports.uploadAvatar = h(async (req, res) => {
  const ApiError = require('../utils/ApiError');
  if (!req.file) throw ApiError.badRequest('No image file provided');
  const url = `/uploads/avatars/${req.file.filename}`;
  const user = await S.profile.uploadAvatar(me(req), url);
  ok(res, user);
});
exports.deleteAvatar = h(async (req, res) => {
  const user = await S.profile.deleteAvatar(me(req));
  ok(res, user);
});

exports.conversations = h(async (req, res) => { const r = await S.messaging.listConversations(me(req), req.query); ok(res, r.items, r.meta); });
exports.createConversation = h(async (req, res) => ok(res, await S.messaging.getOrCreateConversation(me(req), req.body), null, 201));
exports.conversation = h(async (req, res) => ok(res, await S.messaging.getConversation(me(req), req.params.id)));
exports.messages = h(async (req, res) => { const r = await S.messaging.listMessages(me(req), req.params.id, req.query); ok(res, r.items, { total: r.total }); });
exports.sendMessage = h(async (req, res) => ok(res, await S.messaging.sendMessage(me(req), req.params.id, req.body.body), null, 201));
exports.markRead = h(async (req, res) => ok(res, await S.messaging.markAsRead(me(req), req.params.id)));
exports.unreadCount = h(async (req, res) => ok(res, await S.messaging.getUnreadCount(me(req))));


