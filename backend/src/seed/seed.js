/**
 * DEVELOPMENT SEED DATA — entirely fictional. Never run against a production database.
 *   npm run seed            (refuses if data already exists)
 *   npm run seed -- --reset (drops this project's collections first)
 */
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { connectDB } = require('../config/db');
const M = require('../models');
const C = require('../config/constants');

const DAY = 864e5;
const dayAt = (offsetDays) => { const d = new Date(Date.now() + offsetDays * DAY); d.setUTCHours(0, 0, 0, 0); return d; };

async function seed({ reset = false, password = process.env.SEED_INSTRUCTOR_PASSWORD || 'Instructor#Dev123' } = {}) {
  if (env.nodeEnv === 'production') throw new Error('Refusing to seed in production');
  if (reset) await Promise.all(Object.values(M).map((m) => m.deleteMany({})));
  else if (await M.User.countDocuments()) throw new Error('Database already has data. Use --reset to wipe this project\'s collections.');
  const passwordHash = await bcrypt.hash(password, 10);

  const [instructor, instructorB, admin] = await M.User.create([
    { name: 'Dev Instructor Layla Hassan', email: 'instructor@egsa-dev.test', passwordHash, role: C.ROLES.INSTRUCTOR, phone: '+20000000001', professional: { title: 'Systems Engineer (dev data)', organization: 'Development Sandbox', expertise: 'Spacecraft systems (fictional)' } },
    { name: 'Dev Instructor Omar Nabil', email: 'instructor.b@egsa-dev.test', passwordHash, role: C.ROLES.INSTRUCTOR },
    { name: 'Dev Admin', email: 'admin@egsa-dev.test', passwordHash, role: C.ROLES.ADMIN },
  ]);
  const [ssf, scb, omi] = await M.Course.create([
    { code: 'SSF', name: 'Space Systems Fundamentals', description: 'Introduction to spacecraft subsystems and mission architecture. (dev data)', durationWeeks: 6, externalCourseId: 'crs-ssf' },
    { code: 'SCB', name: 'Satellite Communications Basics', description: 'Link budgets, antennas and ground segment basics. (dev data)', durationWeeks: 4, externalCourseId: 'crs-scb' },
    { code: 'OMI', name: 'Orbital Mechanics Introduction', description: 'Keplerian elements and orbit design. (dev data)', durationWeeks: 5, externalCourseId: 'crs-omi' },
  ]);
  const [ssf01, scb01, omi01] = await M.Cohort.create([
    { name: 'SSF-01', course: ssf._id, instructor: instructor._id, startDate: dayAt(-21), endDate: dayAt(21), status: C.COHORT_STATUS.ACTIVE, externalCohortId: 'coh-ssf-01' },
    { name: 'SCB-01', course: scb._id, instructor: instructor._id, startDate: dayAt(-7), endDate: dayAt(21), status: C.COHORT_STATUS.ACTIVE, externalCohortId: 'coh-scb-01' },
    { name: 'OMI-01', course: omi._id, instructor: instructorB._id, startDate: dayAt(-7), endDate: dayAt(28), status: C.COHORT_STATUS.ACTIVE, externalCohortId: 'coh-omi-01' },
  ]);
  const students = await M.StudentReference.create(Array.from({ length: 7 }, (_, i) => ({
    externalStudentId: `stu-dev-${String(i + 1).padStart(3, '0')}`, name: `Dev Student ${String(i + 1).padStart(2, '0')}`, email: `dev.student${String(i + 1).padStart(2, '0')}@example.test` })));
  const enroll = (st, cohort, course, n) => ({ student: st._id, cohort: cohort._id, course: course._id, externalEnrollmentId: `enr-dev-${n}` });
  await M.EnrollmentReference.create([
    ...[0, 1, 2, 3].map((i) => enroll(students[i], ssf01, ssf, `ssf-${i + 1}`)),
    ...[2, 3, 4, 5].map((i) => enroll(students[i], scb01, scb, `scb-${i + 1}`)),
    enroll(students[6], omi01, omi, 'omi-7'),
  ]);

  const mk = (cohort, course, title, off, st, en, status, extra = {}) => ({ title, description: `${title} (dev data)`, cohort: cohort._id, course: course._id, date: dayAt(off), startTime: st, endTime: en, status, location: 'Training Hall A (dev)', ...extra });
  const ssfSessions = await M.Session.create([
    mk(ssf01, ssf, 'Mission Architecture Overview', -14, '09:00', '11:00', C.SESSION_STATUS.COMPLETED),
    mk(ssf01, ssf, 'Power & Thermal Subsystems', -9, '09:00', '11:00', C.SESSION_STATUS.COMPLETED),
    mk(ssf01, ssf, 'Attitude Determination & Control', -3, '09:00', '11:00', C.SESSION_STATUS.COMPLETED),
    mk(ssf01, ssf, 'Launch Vehicles & Integration', 1, '09:00', '11:00', C.SESSION_STATUS.SCHEDULED, { onlineUrl: 'https://meet.example.test/ssf-04' }),
    mk(ssf01, ssf, 'Mission Operations', 6, '09:00', '11:00', C.SESSION_STATUS.SCHEDULED),
  ]);
  const scbSessions = await M.Session.create([
    mk(scb01, scb, 'Link Budget Fundamentals', -4, '13:00', '15:00', C.SESSION_STATUS.COMPLETED),
    mk(scb01, scb, 'Antenna Basics', 2, '13:00', '15:00', C.SESSION_STATUS.SCHEDULED),
    mk(scb01, scb, 'Ground Segment Overview', 8, '13:00', '15:00', C.SESSION_STATUS.SCHEDULED),
  ]);

  const A = C.ATTENDANCE_STATUS, att = [];
  const rec = (s, cohort, stu, status) => att.push({ session: s._id, cohort: cohort._id, student: stu._id, status, markedBy: status === A.PENDING ? undefined : instructor._id, markedAt: status === A.PENDING ? undefined : new Date() });
  const table = [[A.PRESENT, A.PRESENT, A.PRESENT, A.PRESENT], [A.PRESENT, A.ABSENT, A.PRESENT, A.PRESENT], [A.PRESENT, A.PRESENT, A.ABSENT, A.PENDING]];
  table.forEach((row, si) => row.forEach((status, k) => rec(ssfSessions[si], ssf01, students[k], status)));
  [2, 3, 4, 5].forEach((k, i) => rec(scbSessions[0], scb01, students[k], [A.PRESENT, A.ABSENT, A.PRESENT, A.PRESENT][i]));
  await M.Attendance.create(att);

  const [a1, a2, a3, a4] = await M.Assessment.create([
    { title: 'Mission Architecture Report', description: 'Write a concept-level mission architecture for a small LEO satellite.', instructions: 'Submit a 2-page PDF summary or text answer.', cohort: ssf01._id, course: ssf._id, startDate: dayAt(-12), dueDate: dayAt(4), gradingConfig: { maxScore: 100 }, status: C.ASSESSMENT_STATUS.PUBLISHED, publishedAt: new Date(Date.now() - 12 * DAY), createdBy: instructor._id },
    { title: 'Subsystems Quiz', description: 'Short quiz on power, thermal and ADCS.', instructions: 'Answer all questions.', cohort: ssf01._id, course: ssf._id, startDate: dayAt(-3), dueDate: dayAt(1), status: C.ASSESSMENT_STATUS.PUBLISHED, publishedAt: new Date(Date.now() - 3 * DAY), createdBy: instructor._id },
    { title: 'Final Project Brief', description: 'Draft: final project outline.', cohort: ssf01._id, course: ssf._id, status: C.ASSESSMENT_STATUS.DRAFT, createdBy: instructor._id },
    { title: 'Link Budget Exercise', description: 'Compute a simple downlink budget.', instructions: 'Show your working.', cohort: scb01._id, course: scb._id, dueDate: dayAt(5), status: C.ASSESSMENT_STATUS.PUBLISHED, publishedAt: new Date(Date.now() - 2 * DAY), createdBy: instructor._id },
  ]);
  const sub = (a, cohort, stu, text, status, hrs) => ({ assessment: a._id, cohort: cohort._id, student: stu._id, content: text, status, submittedAt: new Date(Date.now() - hrs * 3600e3) });
  const S = C.SUBMISSION_STATUS;
  const subs = await M.AssessmentSubmission.create([
    sub(a1, ssf01, students[0], 'Dev answer: LEO imaging satellite concept.', S.RESULT_PUBLISHED, 96),
    sub(a1, ssf01, students[1], 'Dev answer: Weather-monitoring cubesat concept.', S.EVALUATED, 70),
    sub(a1, ssf01, students[2], 'Dev answer: Communications relay concept.', S.SUBMITTED, 30),
    sub(a2, ssf01, students[0], 'Dev quiz answers set A.', S.SUBMITTED, 10),
    sub(a2, ssf01, students[3], 'Dev quiz answers set B.', S.SUBMITTED, 5),
    sub(a4, scb01, students[2], 'Dev link budget working.', S.SUBMITTED, 8),
  ]);
  await M.AssessmentResult.create([
    { submission: subs[0]._id, assessment: a1._id, cohort: ssf01._id, student: students[0]._id, score: 88, feedback: 'Clear architecture with sound subsystem trade-offs.', strengths: 'Structure and rationale', improvements: 'Quantify the power budget', status: C.RESULT_STATUS.PUBLISHED, evaluatedBy: instructor._id, evaluatedAt: new Date(Date.now() - 48 * 3600e3), publishedAt: new Date(Date.now() - 40 * 3600e3) },
    { submission: subs[1]._id, assessment: a1._id, cohort: ssf01._id, student: students[1]._id, score: 74, feedback: 'Good start; needs more detail on ground segment.', strengths: 'Mission objective', improvements: 'Ground segment', status: C.RESULT_STATUS.EVALUATED, evaluatedBy: instructor._id, evaluatedAt: new Date() },
  ]);

  await M.Notification.create([
    { user: instructor._id, type: C.NOTIFICATION_TYPE.NEW_ASSIGNMENT, title: 'New cohort assigned', message: 'You have been assigned to SSF-01.', link: `/instructor/cohorts/${ssf01._id}` },
    { user: instructor._id, type: C.NOTIFICATION_TYPE.NEW_ASSIGNMENT, title: 'New cohort assigned', message: 'You have been assigned to SCB-01.', link: `/instructor/cohorts/${scb01._id}` },
    { user: instructor._id, type: C.NOTIFICATION_TYPE.SYSTEM, title: 'Welcome to Instructor Mission Control', message: 'Development account created from seed data.' },
  ]);
  await M.ActivityLog.create([
    { user: instructor._id, action: 'assessment.published', entityType: 'Assessment', entityId: a1._id, summary: 'Published "Mission Architecture Report"' },
    { user: instructor._id, action: 'result.published', entityType: 'AssessmentSubmission', entityId: subs[0]._id, summary: 'Published an assessment result' },
  ]);

  const sampleConvo = await M.Conversation.create({
    instructor: instructor._id,
    student: students[0]._id,
    cohort: ssf01._id,
    course: ssf._id,
    lastMessage: 'All ground telemetry parameters look optimal. Ready for the next lab session.',
    lastMessageAt: new Date(Date.now() - 3600e3),
    unreadCountInstructor: 0,
    unreadCountStudent: 0,
  });

  await M.Message.create([
    {
      conversation: sampleConvo._id,
      senderRole: 'instructor',
      senderId: instructor._id,
      body: 'Cadet, please review the attitude determination simulation before tomorrow\'s session.',
      read: true,
      readAt: new Date(Date.now() - 7200e3),
      createdAt: new Date(Date.now() - 7200e3),
    },
    {
      conversation: sampleConvo._id,
      senderRole: 'student',
      senderId: students[0]._id,
      body: 'All ground telemetry parameters look optimal. Ready for the next lab session.',
      read: true,
      readAt: new Date(Date.now() - 3600e3),
      createdAt: new Date(Date.now() - 3600e3),
    },
  ]);

  return { instructor, instructorB, admin, courses: { ssf, scb, omi }, cohorts: { ssf01, scb01, omi01 }, students, ssfSessions, scbSessions, assessments: { a1, a2, a3, a4 }, subs, sampleConvo, password };
}
module.exports = { seed };

if (require.main === module) {
  (async () => {
    await connectDB();
    const r = await seed({ reset: process.argv.includes('--reset') });
    console.log('Seed complete. Dev login: instructor@egsa-dev.test /', r.password);
    process.exit(0);
  })().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
}
