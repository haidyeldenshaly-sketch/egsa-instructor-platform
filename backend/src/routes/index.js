const router = require('express').Router();
router.get('/health', (_q, res) => res.json({ success: true, data: { status: 'ok', service: 'egsa-instructor-api', time: new Date().toISOString() } }));
router.use('/auth', require('./auth.routes'));
router.use('/instructor', require('./instructor.routes'));
router.use('/integration', require('./integration.routes'));
module.exports = router;
