const router = require('express').Router();
const { requireApiKey } = require('../middleware/auth');
const validate = require('../middleware/validate');
const V = require('../validators');
const c = require('../controllers/integration.controller');
router.use(requireApiKey);
router.post('/enrollments', V.intEnroll, validate, c.syncEnrollment);
router.post('/submissions', V.intSubmit, validate, c.submit);
router.get('/assessments', c.assessments);   // PUBLISHED only
router.get('/results', c.results);           // PUBLISHED only
router.get('/attendance', c.attendance);
router.post('/attendance/check-in', V.intCheckIn, validate, c.checkIn);
router.get('/students/:studentId/conversations', c.studentConversations);
router.get('/students/:studentId/conversations/:conversationId/messages', V.id('conversationId'), validate, c.studentMessages);
router.post('/students/:studentId/conversations/:conversationId/messages', V.intMessage, validate, c.studentSendMessage);
module.exports = router;
