const { Cohort, Session, Attendance, AssessmentSubmission, ActivityLog, EnrollmentReference, Notification } = require('../models');
const { COHORT_STATUS, SESSION_STATUS, ENROLLMENT_STATUS, SUBMISSION_STATUS, ATTENDANCE_STATUS } = require('../config/constants');
const { generateReminders } = require('./notification.service');

async function get(instructorId) {
  await generateReminders(instructorId);
  const cohorts = await Cohort.find({ instructor: instructorId }).lean();
  const ids = cohorts.map((c) => c._id);
  const now = new Date();
  const [enrollments, upcoming, pendingCount, pendingList, pastSessions, activity, unread] = await Promise.all([
    EnrollmentReference.find({ cohort: { $in: ids }, status: ENROLLMENT_STATUS.ACTIVE }).select('student').lean(),
    Session.find({ cohort: { $in: ids }, status: SESSION_STATUS.SCHEDULED, startsAt: { $gte: now } }).populate('cohort', 'name').sort({ startsAt: 1 }).limit(5).lean(),
    AssessmentSubmission.countDocuments({ cohort: { $in: ids }, status: SUBMISSION_STATUS.SUBMITTED }),
    AssessmentSubmission.find({ cohort: { $in: ids }, status: SUBMISSION_STATUS.SUBMITTED }).populate('student', 'name').populate('assessment', 'title').sort({ submittedAt: -1 }).limit(5).lean(),
    Session.find({ cohort: { $in: ids }, startsAt: { $lt: now }, status: { $ne: SESSION_STATUS.CANCELLED } }).populate('cohort', 'name').sort({ startsAt: -1 }).limit(5).lean(),
    ActivityLog.find({ user: instructorId }).sort({ createdAt: -1 }).limit(8).lean(),
    Notification.countDocuments({ user: instructorId, read: false }),
  ]);
  const recentAttendance = await Promise.all(pastSessions.map(async (s) => {
    const recs = await Attendance.find({ session: s._id }).select('status').lean();
    return { session: s, present: recs.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length, absent: recs.filter((r) => r.status === ATTENDANCE_STATUS.ABSENT).length, recorded: recs.filter((r) => r.status !== ATTENDANCE_STATUS.PENDING).length };
  }));
  return {
    stats: {
      assignedCourses: new Set(cohorts.map((c) => String(c.course))).size,
      activeCohorts: cohorts.filter((c) => c.status === COHORT_STATUS.ACTIVE).length,
      totalCohorts: cohorts.length,
      students: new Set(enrollments.map((e) => String(e.student))).size,
      upcomingSessions: upcoming.length,
      pendingGrading: pendingCount,
      unreadNotifications: unread,
    },
    upcomingSessions: upcoming, pendingSubmissions: pendingList, recentAttendance, recentActivity: activity,
  };
}
module.exports = { get };
