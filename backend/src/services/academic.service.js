const { Cohort, Course, Session, EnrollmentReference } = require('../models');
const { ENROLLMENT_STATUS, COHORT_STATUS, SESSION_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { isId } = require('../utils/helpers');
const { ownedCohort } = require('./ownership.service');
const { cohortProgress } = require('./progress.service');
const { Assessment } = require('../models');

async function decorateCohorts(cohorts) {
  return Promise.all(cohorts.map(async (c) => {
    const [enrolled, sessions, next] = await Promise.all([
      EnrollmentReference.countDocuments({ cohort: c._id, status: ENROLLMENT_STATUS.ACTIVE }),
      Session.countDocuments({ cohort: c._id }),
      Session.findOne({ cohort: c._id, status: SESSION_STATUS.SCHEDULED, startsAt: { $gte: new Date() } }).sort({ startsAt: 1 }).select('title date startTime').lean(),
    ]);
    return { ...c, enrolledCount: enrolled, sessionsCount: sessions, nextSession: next };
  }));
}
async function listCohorts(instructorId, { status, courseId }) {
  const q = { instructor: instructorId, ...(status ? { status } : {}), ...(courseId && isId(courseId) ? { course: courseId } : {}) };
  const cohorts = await Cohort.find(q).populate('course', 'name code status').populate('instructor', 'name').sort({ startDate: -1 }).lean();
  return decorateCohorts(cohorts);
}
async function getCohort(instructorId, id) {
  const c = await ownedCohort(instructorId, id);
  const [full] = await decorateCohorts([(await c.populate([{ path: 'course', select: 'name code description status durationWeeks' }, { path: 'instructor', select: 'name' }])).toObject()]);
  const [assessments, progress] = await Promise.all([Assessment.countDocuments({ cohort: c._id }), cohortProgress(c._id)]);
  return { ...full, assessmentsCount: assessments, studentsSummary: { total: progress.length } };
}
async function listCourses(instructorId) {
  const cohorts = await Cohort.find({ instructor: instructorId }).lean();
  const ids = [...new Set(cohorts.map((c) => String(c.course)))];
  const courses = await Course.find({ _id: { $in: ids } }).sort({ name: 1 }).lean();
  return courses.map((c) => ({ ...c, assignedCohorts: cohorts.filter((x) => String(x.course) === String(c._id)).map((x) => ({ _id: x._id, name: x.name, status: x.status })) }));
}
async function getCourse(instructorId, id) {
  if (!isId(id)) throw ApiError.notFound();
  const cohorts = await Cohort.find({ instructor: instructorId, course: id }).lean();
  if (!cohorts.length) throw ApiError.notFound(); // not assigned => not found
  const course = await Course.findById(id).lean();
  return { ...course, assignedCohorts: await decorateCohorts(cohorts) };
}
module.exports = { listCohorts, getCohort, listCourses, getCourse };
