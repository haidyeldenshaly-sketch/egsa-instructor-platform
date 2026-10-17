const { asyncHandler: h, ok } = require('../utils/helpers');
const S = require('../services/integration.service');
const messaging = require('../services/messaging.service');

exports.syncEnrollment = h(async (req, res) => ok(res, await S.syncEnrollment(req.body), null, 201));
exports.submit = h(async (req, res) => ok(res, await S.receiveSubmission(req.body), null, 201));
exports.assessments = h(async (req, res) => ok(res, await S.publishedAssessments(req.query)));
exports.results = h(async (req, res) => ok(res, await S.publishedResults(req.query)));
exports.attendance = h(async (req, res) => ok(res, await S.studentAttendance(req.query)));
exports.checkIn = h(async (req, res) => ok(res, await S.recordQrCheckIn(req.body), null, 201));
exports.studentConversations = h(async (req, res) => ok(res, await messaging.studentListConversations(req.params.studentId)));
exports.studentMessages = h(async (req, res) => ok(res, await messaging.studentListMessages(req.params.studentId, req.params.conversationId, req.query)));
exports.studentSendMessage = h(async (req, res) => ok(res, await messaging.studentSendMessage(req.params.studentId, req.params.conversationId, req.body.body), null, 201));

