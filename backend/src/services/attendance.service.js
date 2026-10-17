const { Attendance, EnrollmentReference, Cohort } = require('../models');
const { ATTENDANCE_STATUS, ENROLLMENT_STATUS, SESSION_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { ownedSession, ownedCohort } = require('./ownership.service');
const { cohortProgress } = require('./progress.service');
const activity = require('./activity.service');

// Roster for one session: every active enrollee + their recorded status, QR check-in, and verification info.
async function sessionRoster(instructorId, sessionId) {
  const session = await ownedSession(instructorId, sessionId);
  const [enrolls, recs] = await Promise.all([
    EnrollmentReference.find({ cohort: session.cohort, status: ENROLLMENT_STATUS.ACTIVE }).populate('student', 'name email externalStudentId').lean(),
    Attendance.find({ session: session._id }).lean(),
  ]);
  const map = new Map(recs.map((r) => [String(r.student), r]));
  const roster = enrolls.filter((e) => e.student).map((e) => {
    const r = map.get(String(e.student._id));
    const isLate = r ? (r.isLate || r.subStatus === 'late') : false;
    const isExcused = r ? (r.excused || r.subStatus === 'excused') : false;
    const displayStatus = r
      ? (isLate ? 'late' : isExcused ? 'excused' : r.status)
      : ATTENDANCE_STATUS.PENDING;

    return {
      student: e.student,
      status: r ? r.status : ATTENDANCE_STATUS.PENDING,
      subStatus: isLate ? 'late' : isExcused ? 'excused' : (r?.subStatus || 'none'),
      displayStatus,
      isLate,
      excused: isExcused,
      markedAt: r?.markedAt || null,
      qrCheckIn: r?.qrCheckIn || null,
      source: r?.source || (r?.qrCheckIn?.timestamp ? 'qr_checkin' : 'unrecorded'),
      verified: r?.verified || (r && r.status !== ATTENDANCE_STATUS.PENDING),
      verifiedAt: r?.verifiedAt || r?.markedAt || null,
      notes: r?.notes || '',
    };
  }).sort((a, b) => a.student.name.localeCompare(b.student.name));

  return {
    session: {
      _id: session._id,
      title: session.title,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      cohort: session.cohort,
    },
    roster,
  };
}

// Bulk upsert. The backend validates enrollment & session ownership; frontend status is never trusted blindly.
async function saveAttendance(instructorId, sessionId, records) {
  const session = await ownedSession(instructorId, sessionId);
  if (session.status === SESSION_STATUS.CANCELLED) throw ApiError.conflict('Attendance cannot be recorded for a cancelled session');
  const enrolls = await EnrollmentReference.find({ cohort: session.cohort, status: ENROLLMENT_STATUS.ACTIVE }).select('student').lean();
  const allowed = new Set(enrolls.map((e) => String(e.student)));
  const bad = records.filter((r) => !allowed.has(String(r.studentId)));
  if (bad.length) throw ApiError.unprocessable('Some students are not actively enrolled in this session\'s cohort', bad.map((b) => ({ field: 'studentId', message: String(b.studentId) })));
  
  const now = new Date();
  for (const r of records) {
    const isLate = r.subStatus === 'late' || r.isLate === true || r.status === 'late';
    const isExcused = r.subStatus === 'excused' || r.excused === true || r.status === 'excused';
    
    // Map status to base enum for backward compatibility
    let baseStatus = r.status;
    if (isLate) baseStatus = ATTENDANCE_STATUS.PRESENT;
    if (isExcused) baseStatus = ATTENDANCE_STATUS.ABSENT;

    const isVerified = baseStatus !== ATTENDANCE_STATUS.PENDING;
    const updateSet = {
      status: baseStatus,
      subStatus: isLate ? 'late' : isExcused ? 'excused' : 'none',
      isLate,
      excused: isExcused,
      cohort: session.cohort,
      markedBy: instructorId,
      markedAt: baseStatus === ATTENDANCE_STATUS.PENDING ? null : now,
      verified: isVerified,
      verifiedAt: isVerified ? now : null,
      verifiedBy: isVerified ? instructorId : null,
      notes: r.notes || '',
      source: r.source || 'instructor_manual',
    };

    if (r.qrCheckIn) {
      updateSet['qrCheckIn.verified'] = isVerified;
    }

    await Attendance.updateOne(
      { session: session._id, student: r.studentId },
      { $set: updateSet },
      { upsert: true }
    );
  }
  await activity.log(instructorId, 'attendance.saved', 'Session', session._id, `Recorded attendance for "${session.title}" (${records.length} students)`);
  return sessionRoster(instructorId, sessionId);
}

async function cohortSummary(instructorId, cohortId) {
  const cohort = await ownedCohort(instructorId, cohortId);
  const rows = await cohortProgress(cohort._id);
  return rows.map((r) => ({ student: r.student, trainingStatus: r.trainingStatus, ...r.attendance }));
}

module.exports = { sessionRoster, saveAttendance, cohortSummary };
