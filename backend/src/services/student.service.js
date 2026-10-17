const { EnrollmentReference, StudentReference, Attendance, Session, AssessmentSubmission, AssessmentResult, Assessment } = require('../models');
const { escapeRegex, isId } = require('../utils/helpers');
const { ownedCohort, ownedCohortIds, ownedStudentEnrollments } = require('./ownership.service');
const { cohortProgress } = require('./progress.service');
const { Cohort } = require('../models');

async function list(instructorId, { cohortId, search, status }) {
  let ids = await ownedCohortIds(instructorId);
  if (cohortId) { await ownedCohort(instructorId, cohortId); ids = [cohortId]; }
  const cohorts = await Cohort.find({ _id: { $in: ids } }).populate('course', 'name code').lean();
  const rows = [];
  for (const c of cohorts) {
    const p = await cohortProgress(c._id, status ? { status } : {});
    p.forEach((r) => rows.push({ ...r, cohort: { _id: c._id, name: c.name }, course: c.course }));
  }
  const q = search && search.trim().toLowerCase();
  return q ? rows.filter((r) => r.student.name.toLowerCase().includes(q) || r.student.email.includes(q)) : rows;
}
// Academic/training profile ONLY: no payment, password or unrelated personal data exists in this model by design.
async function profile(instructorId, studentId) {
  const enrollments = await ownedStudentEnrollments(instructorId, studentId);
  const student = await StudentReference.findById(studentId).select('name email externalStudentId').lean();
  const cohortIds = enrollments.map((e) => e.cohort);
  const cohorts = await Cohort.find({ _id: { $in: cohortIds } }).populate('course', 'name code').lean();
  const [attendance, submissions, results] = await Promise.all([
    Attendance.find({ student: studentId, cohort: { $in: cohortIds } }).populate('session', 'title date startTime').lean(),
    AssessmentSubmission.find({ student: studentId, cohort: { $in: cohortIds } }).populate('assessment', 'title dueDate').lean(),
    AssessmentResult.find({ student: studentId, cohort: { $in: cohortIds } }).lean(),
  ]);
  const progress = [];
  for (const c of cohorts) { const p = await cohortProgress(c._id, { student: studentId }); if (p[0]) progress.push({ ...p[0], cohort: { _id: c._id, name: c.name }, course: c.course }); }
  return {
    student, progress,
    attendanceRecords: attendance.map((a) => ({ _id: a._id, session: a.session, status: a.status, markedAt: a.markedAt })),
    submissions: submissions.map((s) => ({ _id: s._id, assessment: s.assessment, status: s.status, submittedAt: s.submittedAt, result: (() => { const r = results.find((x) => String(x.submission) === String(s._id)); return r ? { status: r.status, score: r.score, publishedAt: r.publishedAt } : null; })() })),
  };
}
module.exports = { list, profile };
