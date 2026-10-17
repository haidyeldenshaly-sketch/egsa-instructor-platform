/**
 * Future-facing, service-to-service API for the Student Project (protected by x-api-key, NOT by user JWT).
 * It is standalone-safe: nothing here calls the Student Project. See INTEGRATION_CONTRACT.md.
 * Student-facing reads expose ONLY published assessments / published results.
 */
const { Cohort, Session, StudentReference, EnrollmentReference, Assessment, AssessmentSubmission, AssessmentResult, Attendance } = require('../models');
const { ASSESSMENT_STATUS, RESULT_STATUS, ENROLLMENT_STATUS, NOTIFICATION_TYPE, SESSION_STATUS, ATTENDANCE_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { isId } = require('../utils/helpers');
const { notify } = require('./notification.service');

async function resolveCohort({ cohortId, externalCohortId }) {
  const c = cohortId && isId(cohortId) ? await Cohort.findById(cohortId) : externalCohortId ? await Cohort.findOne({ externalCohortId }) : null;
  if (!c) throw ApiError.notFound('Cohort not found');
  return c;
}

async function syncEnrollment(b) {
  const cohort = await resolveCohort(b);
  const student = await StudentReference.findOneAndUpdate(
    { externalStudentId: b.externalStudentId },
    { $set: { name: b.name, email: b.email } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  const enrollment = await EnrollmentReference.findOneAndUpdate(
    { student: student._id, cohort: cohort._id },
    { $set: { course: cohort.course, status: b.status || ENROLLMENT_STATUS.ACTIVE, externalEnrollmentId: b.externalEnrollmentId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { studentId: student._id, enrollmentId: enrollment._id, cohortId: cohort._id };
}

async function receiveSubmission(b) {
  if (!isId(String(b.assessmentId))) throw ApiError.notFound('Assessment not found');
  const assessment = await Assessment.findById(b.assessmentId);
  if (!assessment) throw ApiError.notFound('Assessment not found');
  if (assessment.status !== ASSESSMENT_STATUS.PUBLISHED) throw ApiError.conflict('Assessment is not published');
  const student = await StudentReference.findOne({ externalStudentId: b.externalStudentId });
  const enrollment = student && await EnrollmentReference.findOne({ student: student._id, cohort: assessment.cohort, status: ENROLLMENT_STATUS.ACTIVE });
  if (!enrollment) throw ApiError.forbidden('Student is not actively enrolled in this assessment\'s cohort');
  if (assessment.dueDate && b.submittedAt && new Date(b.submittedAt) > new Date(assessment.dueDate)) { /* late submissions are recorded; no late-policy is invented */ }
  if (await AssessmentSubmission.exists({ assessment: assessment._id, student: student._id })) throw ApiError.conflict('A submission already exists for this student');
  const sub = await AssessmentSubmission.create({ assessment: assessment._id, cohort: assessment.cohort, student: student._id, content: b.content, attachments: b.attachments, externalSubmissionId: b.externalSubmissionId, submittedAt: b.submittedAt || new Date() });
  const cohort = await Cohort.findById(assessment.cohort).select('instructor');
  await notify(cohort.instructor, { type: NOTIFICATION_TYPE.NEW_SUBMISSION, title: 'New student submission', message: `${student.name} submitted "${assessment.title}"`, link: `/instructor/submissions/${sub._id}`, dedupeKey: `sub:${sub._id}` });
  return { submissionId: sub._id, status: sub.status };
}

async function publishedAssessments(q) {
  const cohort = await resolveCohort(q);
  return Assessment.find({ cohort: cohort._id, status: ASSESSMENT_STATUS.PUBLISHED }).select('title description instructions startDate dueDate attachments gradingConfig publishedAt cohort course').lean();
}

async function publishedResults({ externalStudentId, assessmentId }) {
  const student = await StudentReference.findOne({ externalStudentId });
  if (!student) throw ApiError.notFound('Student not found');
  const q = { student: student._id, status: RESULT_STATUS.PUBLISHED, ...(assessmentId && isId(assessmentId) ? { assessment: assessmentId } : {}) };
  return AssessmentResult.find(q).select('submission assessment score feedback strengths improvements publishedAt').lean();
}

async function studentAttendance({ externalStudentId, cohortId }) {
  const student = await StudentReference.findOne({ externalStudentId });
  if (!student) throw ApiError.notFound('Student not found');
  return Attendance.find({ student: student._id, ...(cohortId && isId(cohortId) ? { cohort: cohortId } : {}) }).select('session status markedAt verified qrCheckIn').lean();
}

async function recordQrCheckIn(b) {
  if (!b.sessionId || !isId(String(b.sessionId))) throw ApiError.notFound('Session not found');
  const session = await Session.findById(b.sessionId);
  if (!session) throw ApiError.notFound('Session not found');
  if (session.status === SESSION_STATUS.CANCELLED) throw ApiError.conflict('Cannot check in to a cancelled session');

  const student = await StudentReference.findOne({ externalStudentId: b.externalStudentId });
  if (!student) throw ApiError.notFound('Student not found');

  const enrollment = await EnrollmentReference.findOne({ student: student._id, cohort: session.cohort, status: ENROLLMENT_STATUS.ACTIVE });
  if (!enrollment) throw ApiError.forbidden('Student is not actively enrolled in this session\'s cohort');

  const checkInTime = b.timestamp ? new Date(b.timestamp) : new Date();

  let record = await Attendance.findOne({ session: session._id, student: student._id });
  if (!record) {
    record = await Attendance.create({
      session: session._id,
      cohort: session.cohort,
      student: student._id,
      status: ATTENDANCE_STATUS.PENDING,
      qrCheckIn: {
        timestamp: checkInTime,
        method: b.checkInMethod || 'qr_code',
        deviceInfo: b.deviceInfo || '',
        verified: false,
      },
      source: 'qr_checkin',
      verified: false,
    });
  } else {
    record.qrCheckIn = {
      timestamp: checkInTime,
      method: b.checkInMethod || 'qr_code',
      deviceInfo: b.deviceInfo || '',
      verified: record.verified || false,
    };
    if (record.source === 'unrecorded') record.source = 'qr_checkin';
    await record.save();
  }

  return {
    success: true,
    attendanceId: record._id,
    sessionId: session._id,
    studentId: student._id,
    status: record.status,
    verified: record.verified,
    qrTimestamp: checkInTime,
  };
}

module.exports = {
  syncEnrollment,
  receiveSubmission,
  publishedAssessments,
  publishedResults,
  studentAttendance,
  recordQrCheckIn,
};
