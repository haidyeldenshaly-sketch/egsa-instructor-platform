const { body, param, query } = require('express-validator');
const { ATTENDANCE_STATUS, SESSION_STATUS } = require('../config/constants');
const id = (name = 'id', loc = param) => loc(name).matches(/^[a-f\d]{24}$/i).withMessage('Invalid id');
const optId = (name, loc = query) => loc(name).optional({ values: 'falsy' }).matches(/^[a-f\d]{24}$/i).withMessage('Invalid id');
const date = (n, opt = true) => (opt ? body(n).optional({ values: 'falsy' }) : body(n)).isISO8601().withMessage(`${n} must be a valid date`);
const time = (n) => body(n).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage(`${n} must be HH:mm`);
const optTime = (n) => body(n).optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage(`${n} must be HH:mm`);
const str = (n, max, req = false) => { const c = body(n); return (req ? c.exists({ checkNull: true }).withMessage(`${n} is required`).bail() : c.optional({ values: 'null' })).isString().trim().isLength({ min: req ? 1 : 0, max }).withMessage(`${n} must be 1-${max} characters`); };
const password = (n) => body(n).isString().isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters').matches(/[A-Za-z]/).withMessage('Password needs a letter').matches(/\d/).withMessage('Password needs a number');

module.exports = {
  id, optId,
  login: [body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(), body('password').isString().notEmpty().withMessage('Password required')],
  refresh: [body('refreshToken').isString().notEmpty()],
  forgot: [body('email').trim().isEmail().normalizeEmail()],
  reset: [body('token').isString().notEmpty(), password('password')],
  session: { create: [id('cohortId', body), str('title', 160, true), str('description', 2000), date('date', false), time('startTime'), time('endTime'), str('location', 200), str('onlineUrl', 500)],
    update: [id(), str('title', 160), str('description', 2000), date('date'), optTime('startTime'), optTime('endTime'), body('status').optional().isIn(Object.values(SESSION_STATUS))] },
  attendance: [id('sessionId'), body('records').isArray({ min: 1, max: 500 }).withMessage('records must be a non-empty array'), body('records.*.studentId').matches(/^[a-f\d]{24}$/i).withMessage('Invalid studentId'), body('records.*.status').isIn(Object.values(ATTENDANCE_STATUS)).withMessage('Invalid attendance status')],
  assessment: { create: [id('cohortId', body), str('title', 200, true), str('description', 3000), str('instructions', 5000), date('startDate'), date('dueDate'), body('gradingConfig.maxScore').optional({ values: 'null' }).isFloat({ min: 0 }).toFloat(), body('attachments').optional().isArray()],
    update: [id(), str('title', 200), str('description', 3000), str('instructions', 5000), date('startDate'), date('dueDate'), body('gradingConfig.maxScore').optional({ values: 'null' }).isFloat({ min: 0 }).toFloat(), body('attachments').optional().isArray()] },
  grade: [id(), body('score').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Score must be a non-negative number').toFloat(), str('feedback', 5000), str('strengths', 3000), str('improvements', 3000)],
  profile: [str('name', 120), str('phone', 30), body('preferredLanguage').optional().isIn(['en', 'ar']), str('professional.title', 120), str('professional.organization', 160), str('professional.expertise', 500), str('avatarUrl', 2000)],
  password: [body('currentPassword').isString().notEmpty(), password('newPassword')],
  intEnroll: [body('externalStudentId').isString().notEmpty(), body('name').isString().notEmpty(), body('email').isEmail()],
  intSubmit: [body('assessmentId').isString().notEmpty(), body('externalStudentId').isString().notEmpty(), body('content').optional().isString().isLength({ max: 20000 }), body('submittedAt').optional().isISO8601()],
  intCheckIn: [body('externalStudentId').isString().notEmpty().withMessage('externalStudentId required'), id('sessionId', body), body('timestamp').optional().isISO8601(), body('checkInMethod').optional().isString(), body('deviceInfo').optional().custom((val) => typeof val === 'object' || typeof val === 'string')],
  startConversation: [id('studentId', body), optId('cohortId', body)],
  sendMessage: [id(), str('body', 2000, true)],
  intMessage: [id('conversationId', param), str('body', 2000, true)],
};
