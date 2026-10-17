/**
 * RESOURCE-LEVEL AUTHORIZATION (anti-IDOR).
 * Every instructor resource is resolved THROUGH the assignment (Cohort.instructor === JWT user id).
 * Foreign or unknown resources both return 404 so existence is not leaked.
 */
const { Cohort, Session, Assessment, AssessmentSubmission, EnrollmentReference } = require('../models');
const ApiError = require('../utils/ApiError');
const { isId } = require('../utils/helpers');
const NF = () => ApiError.notFound();

const ownedCohortIds = async (instructorId) => (await Cohort.find({ instructor: instructorId }).select('_id').lean()).map((c) => c._id);

async function ownedCohort(instructorId, cohortId) {
  if (!isId(String(cohortId))) throw NF();
  const c = await Cohort.findOne({ _id: cohortId, instructor: instructorId });
  if (!c) throw NF();
  return c;
}
async function ownedSession(instructorId, sessionId) {
  if (!isId(String(sessionId))) throw NF();
  const s = await Session.findById(sessionId);
  if (!s) throw NF();
  await ownedCohort(instructorId, s.cohort);
  return s;
}
async function ownedAssessment(instructorId, assessmentId) {
  if (!isId(String(assessmentId))) throw NF();
  const a = await Assessment.findById(assessmentId);
  if (!a) throw NF();
  await ownedCohort(instructorId, a.cohort);
  return a;
}
async function ownedSubmission(instructorId, submissionId) {
  if (!isId(String(submissionId))) throw NF();
  const s = await AssessmentSubmission.findById(submissionId);
  if (!s) throw NF();
  await ownedCohort(instructorId, s.cohort);
  return s;
}
// A student is accessible only if enrolled in at least one cohort assigned to this instructor.
async function ownedStudentEnrollments(instructorId, studentId) {
  if (!isId(String(studentId))) throw NF();
  const ids = await ownedCohortIds(instructorId);
  const enrollments = await EnrollmentReference.find({ student: studentId, cohort: { $in: ids } });
  if (!enrollments.length) throw NF();
  return enrollments;
}

async function ownedConversation(instructorId, conversationId) {
  if (!isId(String(conversationId))) throw NF();
  const { Conversation } = require('../models');
  const conv = await Conversation.findOne({ _id: conversationId, instructor: instructorId })
    .populate('student', 'name email externalStudentId')
    .populate('cohort', 'name')
    .populate('course', 'name code');
  if (!conv) throw NF();
  return conv;
}

module.exports = { ownedCohortIds, ownedCohort, ownedSession, ownedAssessment, ownedSubmission, ownedStudentEnrollments, ownedConversation };
