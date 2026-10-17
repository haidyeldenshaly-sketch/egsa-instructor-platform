/**
 * Progress = underlying REAL metrics only. No invented overall percentage, pass mark or threshold.
 * attendancePercentage = (present + late) / (present + late + absent) over RECORDED sessions; null when nothing is recorded.
 * Excused absences do not penalize the attendance percentage.
 */
const { Session, Attendance, Assessment, AssessmentSubmission, AssessmentResult, EnrollmentReference } = require('../models');
const { SESSION_STATUS, ATTENDANCE_STATUS, ASSESSMENT_STATUS, RESULT_STATUS } = require('../config/constants');
const { pct } = require('../utils/helpers');

async function cohortProgress(cohortId, enrollmentFilter = {}) {
  const [enrollments, sessions, assessments] = await Promise.all([
    EnrollmentReference.find({ cohort: cohortId, ...enrollmentFilter }).populate('student', 'name email externalStudentId').lean(),
    Session.find({ cohort: cohortId, status: { $ne: SESSION_STATUS.CANCELLED } }).select('_id status').lean(),
    Assessment.find({ cohort: cohortId, status: ASSESSMENT_STATUS.PUBLISHED }).select('_id').lean(),
  ]);
  const sessionIds = sessions.map((s) => String(s._id));
  const [att, subs, results] = await Promise.all([
    Attendance.find({ cohort: cohortId, session: { $in: sessionIds } }).lean(),
    AssessmentSubmission.find({ cohort: cohortId }).lean(),
    AssessmentResult.find({ cohort: cohortId }).lean(),
  ]);
  const by = (arr, f) => arr.reduce((m, x) => { const k = String(f(x)); (m[k] ||= []).push(x); return m; }, {});
  const attBy = by(att, (a) => a.student), subBy = by(subs, (s) => s.student), resBy = by(results, (r) => r.student);
  return enrollments.filter((e) => e.student).map((e) => {
    const sid = String(e.student._id);
    const a = attBy[sid] || [];
    const present = a.filter((x) => x.status === ATTENDANCE_STATUS.PRESENT).length;
    const late = a.filter((x) => x.status === ATTENDANCE_STATUS.LATE).length;
    const absent = a.filter((x) => x.status === ATTENDANCE_STATUS.ABSENT).length;
    const excused = a.filter((x) => x.status === ATTENDANCE_STATUS.EXCUSED).length;
    const pending = Math.max(sessions.length - present - late - absent - excused, 0);
    const attended = present + late;
    const evaluatedTotal = attended + absent;
    const s = subBy[sid] || [], r = resBy[sid] || [];
    return {
      enrollmentId: e._id,
      trainingStatus: e.status,
      student: e.student,
      cohort: cohortId,
      attendance: {
        totalSessions: sessions.length,
        present,
        late,
        absent,
        excused,
        pending,
        attendancePercentage: pct(attended, evaluatedTotal),
      },
      assessments: {
        published: assessments.length,
        submitted: s.length,
        pendingGrading: s.filter((x) => x.status === 'submitted').length,
        graded: r.length,
        resultsPublished: r.filter((x) => x.status === RESULT_STATUS.PUBLISHED).length,
        notSubmitted: Math.max(assessments.length - s.length, 0),
      },
    };
  });
}

module.exports = { cohortProgress };
