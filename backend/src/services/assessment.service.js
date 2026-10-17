const { Assessment, AssessmentSubmission, AssessmentResult, EnrollmentReference } = require('../models');
const { ASSESSMENT_STATUS, SUBMISSION_STATUS, RESULT_STATUS, ENROLLMENT_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { pick, isId } = require('../utils/helpers');
const { ownedCohort, ownedCohortIds, ownedAssessment, ownedSubmission } = require('./ownership.service');
const activity = require('./activity.service');

const A_FIELDS = ['title', 'description', 'instructions', 'startDate', 'dueDate', 'attachments', 'gradingConfig'];
function checkDates(a) { if (a.startDate && a.dueDate && new Date(a.dueDate) < new Date(a.startDate)) throw ApiError.badRequest('Due date must be after start date'); }

async function create(instructorId, body) {
  const cohort = await ownedCohort(instructorId, body.cohortId);
  checkDates(body);
  const a = await Assessment.create({ ...pick(body, A_FIELDS), cohort: cohort._id, course: cohort.course, createdBy: instructorId, status: ASSESSMENT_STATUS.DRAFT });
  await activity.log(instructorId, 'assessment.created', 'Assessment', a._id, `Created draft "${a.title}"`);
  return a;
}

async function update(instructorId, id, body) {
  const a = await ownedAssessment(instructorId, id);
  if (a.status !== ASSESSMENT_STATUS.DRAFT) throw ApiError.conflict('Only draft assessments can be edited');
  checkDates({ startDate: body.startDate ?? a.startDate, dueDate: body.dueDate ?? a.dueDate });
  Object.assign(a, pick(body, A_FIELDS));
  await a.save();
  return a;
}

async function publish(instructorId, id) {
  const a = await ownedAssessment(instructorId, id);
  if (a.status === ASSESSMENT_STATUS.PUBLISHED) throw ApiError.conflict('Assessment is already published');
  if (!a.title || !(a.instructions || a.description)) throw ApiError.unprocessable('Add a description or instructions before publishing');
  a.status = ASSESSMENT_STATUS.PUBLISHED; a.publishedAt = new Date();
  await a.save();
  await activity.log(instructorId, 'assessment.published', 'Assessment', a._id, `Published "${a.title}"`);
  return a;
}

async function remove(instructorId, id) {
  const a = await ownedAssessment(instructorId, id);
  if (a.status !== ASSESSMENT_STATUS.DRAFT) throw ApiError.conflict('Only draft assessments can be deleted');
  await a.deleteOne();
  await activity.log(instructorId, 'assessment.deleted', 'Assessment', a._id, `Deleted draft "${a.title}"`);
}

async function counts(assessmentId) {
  const assessment = await Assessment.findById(assessmentId).select('cohort dueDate').lean();
  const [subs, enrollmentsCount] = await Promise.all([
    AssessmentSubmission.find({ assessment: assessmentId }).select('status submittedAt').lean(),
    assessment ? EnrollmentReference.countDocuments({ cohort: assessment.cohort, status: ENROLLMENT_STATUS.ACTIVE }) : 0,
  ]);
  const dueDate = assessment?.dueDate ? new Date(assessment.dueDate) : null;
  const late = dueDate ? subs.filter((s) => s.submittedAt && new Date(s.submittedAt) > dueDate).length : 0;
  return {
    enrolledCount: enrollmentsCount,
    submitted: subs.length,
    pendingGrading: subs.filter((s) => s.status === SUBMISSION_STATUS.SUBMITTED).length,
    evaluated: subs.filter((s) => s.status === SUBMISSION_STATUS.EVALUATED).length,
    resultsPublished: subs.filter((s) => s.status === SUBMISSION_STATUS.RESULT_PUBLISHED).length,
    late,
  };
}

async function list(instructorId, { cohortId, status }) {
  let ids = await ownedCohortIds(instructorId);
  if (cohortId) { await ownedCohort(instructorId, cohortId); ids = [cohortId]; }
  const items = await Assessment.find({ cohort: { $in: ids }, ...(status ? { status } : {}) }).populate('course', 'name code').populate('cohort', 'name').sort({ createdAt: -1 }).lean();
  return Promise.all(items.map(async (a) => ({ ...a, submissions: await counts(a._id) })));
}

async function get(instructorId, id) {
  const a = await ownedAssessment(instructorId, id);
  await a.populate([{ path: 'course', select: 'name code' }, { path: 'cohort', select: 'name' }]);
  return { ...a.toObject(), submissions: await counts(a._id) };
}

// ---- submissions & grading ----
async function listSubmissions(instructorId, { assessmentId, cohortId, status }) {
  let q;
  if (assessmentId) { const a = await ownedAssessment(instructorId, assessmentId); q = { assessment: a._id }; }
  else { let ids = await ownedCohortIds(instructorId); if (cohortId) { await ownedCohort(instructorId, cohortId); ids = [cohortId]; } q = { cohort: { $in: ids } }; }
  if (status) q.status = status;
  const subs = await AssessmentSubmission.find(q).populate('student', 'name email').populate('assessment', 'title dueDate gradingConfig').sort({ submittedAt: -1 }).lean();
  const results = await AssessmentResult.find({ submission: { $in: subs.map((s) => s._id) } }).lean();
  const rm = new Map(results.map((r) => [String(r.submission), r]));
  return subs.map((s) => {
    const isLate = Boolean(s.assessment?.dueDate && s.submittedAt && new Date(s.submittedAt) > new Date(s.assessment.dueDate));
    return {
      ...s,
      isLate,
      result: rm.get(String(s._id)) ? pick(rm.get(String(s._id)), ['status', 'score', 'publishedAt']) : null,
    };
  });
}

async function getSubmission(instructorId, id) {
  const s = await ownedSubmission(instructorId, id);
  await s.populate([{ path: 'student', select: 'name email' }, { path: 'assessment', select: 'title instructions dueDate gradingConfig status' }]);
  const result = await AssessmentResult.findOne({ submission: s._id }).lean();
  const isLate = Boolean(s.assessment?.dueDate && s.submittedAt && new Date(s.submittedAt) > new Date(s.assessment.dueDate));
  return { ...s.toObject(), isLate, result };
}

async function grade(instructorId, id, body) {
  const s = await ownedSubmission(instructorId, id);
  const assessment = await ownedAssessment(instructorId, s.assessment);
  const existing = await AssessmentResult.findOne({ submission: s._id });
  if (existing && existing.status === RESULT_STATUS.PUBLISHED) throw ApiError.conflict('The result is already published and can no longer be changed');
  const max = assessment.gradingConfig?.maxScore;
  if (body.score !== undefined && body.score !== null) {
    if (body.score < 0) throw ApiError.unprocessable('Score cannot be negative');
    if (max != null && body.score > max) throw ApiError.unprocessable(`Score cannot exceed the configured maximum (${max})`);
  }
  const data = pick(body, ['score', 'feedback', 'strengths', 'improvements']);
  if (!Object.values(data).some((v) => v !== undefined && v !== null && v !== '')) throw ApiError.badRequest('Provide at least a score or feedback');
  const doc = await AssessmentResult.findOneAndUpdate(
    { submission: s._id },
    { $set: { ...data, assessment: s.assessment, cohort: s.cohort, student: s.student, status: RESULT_STATUS.EVALUATED, evaluatedBy: instructorId, evaluatedAt: new Date() } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  s.status = SUBMISSION_STATUS.EVALUATED; await s.save();
  await activity.log(instructorId, 'submission.graded', 'AssessmentSubmission', s._id, `Saved evaluation for "${assessment.title}"`);
  return doc;
}

async function publishResult(instructorId, id) {
  const s = await ownedSubmission(instructorId, id);
  const r = await AssessmentResult.findOne({ submission: s._id });
  if (!r) throw ApiError.conflict('Evaluate the submission before publishing a result');
  if (r.status === RESULT_STATUS.PUBLISHED) throw ApiError.conflict('Result is already published');
  r.status = RESULT_STATUS.PUBLISHED; r.publishedAt = new Date(); await r.save();
  s.status = SUBMISSION_STATUS.RESULT_PUBLISHED; await s.save();
  await activity.log(instructorId, 'result.published', 'AssessmentSubmission', s._id, 'Published an assessment result');
  return r;
}

module.exports = {
  create, update, publish, remove, list, get,
  listSubmissions, getSubmission, grade, publishResult,
};
