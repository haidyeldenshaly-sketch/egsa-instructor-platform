const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const V = require('../validators');
const c = require('../controllers/instructor.controller');
const { ROLES } = require('../config/constants');
const { query } = require('express-validator');
const { avatarUpload, fileUpload } = require('../middleware/upload');

router.use(authenticate, authorize(ROLES.INSTRUCTOR)); // every route below: JWT + instructor role; resource-level checks are in services/ownership

router.get('/dashboard', c.dashboard);
router.get('/courses', c.courses);
router.get('/courses/:id', V.id(), validate, c.course);

router.get('/cohorts', c.cohorts);
router.get('/cohorts/:id', V.id(), validate, c.cohort);
router.get('/cohorts/:id/students', V.id(), validate, c.cohortStudents);
router.get('/cohorts/:id/sessions', V.id(), validate, c.cohortSessions);
router.get('/cohorts/:id/attendance', V.id(), validate, c.cohortAttendance);
router.get('/cohorts/:id/assessments', V.id(), validate, c.cohortAssessments);
router.get('/cohorts/:id/progress', V.id(), validate, c.cohortProgress);

router.get('/sessions', [V.optId('cohortId')], validate, c.sessions);
router.post('/sessions', V.session.create, validate, c.createSession);
router.get('/sessions/:id', V.id(), validate, c.session);
router.patch('/sessions/:id', V.session.update, validate, c.updateSession);

router.get('/students', [V.optId('cohortId')], validate, c.students);
router.get('/students/:id', V.id(), validate, c.student);

router.get('/attendance/sessions/:sessionId', V.id('sessionId'), validate, c.roster);
router.put('/attendance/sessions/:sessionId', V.attendance, validate, c.saveAttendance);
router.get('/attendance/cohorts/:cohortId', V.id('cohortId'), validate, c.attendanceSummary);

router.get('/assessments', [V.optId('cohortId')], validate, c.assessments);
router.post('/assessments', V.assessment.create, validate, c.createAssessment);
router.get('/assessments/:id', V.id(), validate, c.assessment);
router.patch('/assessments/:id', V.assessment.update, validate, c.updateAssessment);
router.delete('/assessments/:id', V.id(), validate, c.deleteAssessment);
router.post('/assessments/:id/publish', V.id(), validate, c.publishAssessment);
router.get('/assessments/:id/submissions', V.id(), validate, c.assessmentSubmissions);

router.get('/submissions', [V.optId('assessmentId'), V.optId('cohortId')], validate, c.submissions);
router.get('/submissions/:id', V.id(), validate, c.submission);
router.put('/submissions/:id/grade', V.grade, validate, c.grade);
router.post('/submissions/:id/publish-result', V.id(), validate, c.publishResult);

router.get('/progress', [V.optId('cohortId')], validate, c.progress);


router.get('/notifications', c.notifications);
router.post('/notifications/read-all', c.readAll);
router.patch('/notifications/:id/read', V.id(), validate, c.readNotification);

router.get('/profile', c.profile);
router.patch('/profile', V.profile, validate, c.updateProfile);
router.put('/profile/password', V.password, validate, c.changePassword);
router.post('/profile/avatar', avatarUpload.single('avatar'), c.uploadAvatar);
router.delete('/profile/avatar', c.deleteAvatar);
router.get('/conversations', c.conversations);
router.post('/conversations', V.startConversation, validate, c.createConversation);
router.get('/conversations/:id', V.id(), validate, c.conversation);
router.get('/conversations/:id/messages', V.id(), validate, c.messages);
router.post('/conversations/:id/messages', V.sendMessage, validate, c.sendMessage);
router.patch('/conversations/:id/read', V.id(), validate, c.markRead);
router.get('/messages/unread-count', c.unreadCount);

router.post('/upload', fileUpload.single('file'), c.uploadFile);

module.exports = router;
