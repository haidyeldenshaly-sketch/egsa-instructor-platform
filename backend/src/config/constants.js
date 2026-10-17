const freeze = (o) => Object.freeze(o);
module.exports = {
  ROLES: freeze({ INSTRUCTOR: 'instructor', ADMIN: 'admin', STUDENT: 'student' }),
  ACCOUNT_STATUS: freeze({ ACTIVE: 'active', SUSPENDED: 'suspended' }),
  COURSE_STATUS: freeze({ ACTIVE: 'active', INACTIVE: 'inactive', ARCHIVED: 'archived' }),
  COHORT_STATUS: freeze({ UPCOMING: 'upcoming', ACTIVE: 'active', COMPLETED: 'completed', CANCELLED: 'cancelled' }),
  SESSION_STATUS: freeze({ SCHEDULED: 'scheduled', COMPLETED: 'completed', CANCELLED: 'cancelled' }),
  ENROLLMENT_STATUS: freeze({ ACTIVE: 'active', COMPLETED: 'completed', WITHDRAWN: 'withdrawn' }),
  ATTENDANCE_STATUS: freeze({ PRESENT: 'present', ABSENT: 'absent', PENDING: 'pending' }),
  ASSESSMENT_STATUS: freeze({ DRAFT: 'draft', PUBLISHED: 'published' }),
  SUBMISSION_STATUS: freeze({ SUBMITTED: 'submitted', EVALUATED: 'evaluated', RESULT_PUBLISHED: 'result_published' }),
  RESULT_STATUS: freeze({ EVALUATED: 'evaluated', PUBLISHED: 'published' }),
  NOTIFICATION_TYPE: freeze({
    NEW_SUBMISSION: 'new_submission', ASSESSMENT_DEADLINE: 'assessment_deadline',
    UPCOMING_SESSION: 'upcoming_session', NEW_ASSIGNMENT: 'new_assignment', SYSTEM: 'system',
    NEW_MESSAGE: 'new_message',
  }),
};
