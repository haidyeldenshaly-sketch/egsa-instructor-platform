const mongoose = require('mongoose');
const { Conversation, Message, Cohort, StudentReference, EnrollmentReference, Notification } = require('../models');
const { ownedStudentEnrollments, ownedConversation, ownedCohort } = require('./ownership.service');
const ApiError = require('../utils/ApiError');
const { isId } = require('../utils/helpers');
const { NOTIFICATION_TYPE } = require('../config/constants');

/**
 * List all conversations for the given instructor.
 */
async function listConversations(instructorId, { search } = {}) {
  const query = { instructor: instructorId };
  let convs = await Conversation.find(query)
    .populate('student', 'name email externalStudentId')
    .populate('cohort', 'name')
    .populate('course', 'name code')
    .sort({ lastMessageAt: -1 })
    .lean();

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    convs = convs.filter((c) => {
      const name = c.student?.name?.toLowerCase() || '';
      const email = c.student?.email?.toLowerCase() || '';
      const ext = c.student?.externalStudentId?.toLowerCase() || '';
      const cohortName = c.cohort?.name?.toLowerCase() || '';
      return name.includes(q) || email.includes(q) || ext.includes(q) || cohortName.includes(q);
    });
  }

  const unreadTotal = convs.reduce((sum, c) => sum + (c.unreadCountInstructor || 0), 0);
  return { items: convs, meta: { total: convs.length, unreadTotal } };
}

/**
 * Start or get an existing conversation between instructor and an authorized student.
 */
async function getOrCreateConversation(instructorId, { studentId, cohortId }) {
  if (!isId(String(studentId))) throw ApiError.badRequest('Invalid studentId');
  const enrollments = await ownedStudentEnrollments(instructorId, studentId);

  let selectedCohortId = cohortId;
  if (selectedCohortId) {
    if (!isId(String(selectedCohortId))) throw ApiError.badRequest('Invalid cohortId');
    await ownedCohort(instructorId, selectedCohortId);
    const valid = enrollments.some((e) => String(e.cohort) === String(selectedCohortId));
    if (!valid) throw ApiError.badRequest('Student is not enrolled in the specified cohort');
  } else {
    selectedCohortId = enrollments[0].cohort;
  }

  // Find existing conversation for this instructor, student and cohort
  let conv = await Conversation.findOne({
    instructor: instructorId,
    student: studentId,
    cohort: selectedCohortId,
  })
    .populate('student', 'name email externalStudentId')
    .populate('cohort', 'name')
    .populate('course', 'name code');

  if (!conv) {
    const cohort = await Cohort.findById(selectedCohortId).select('course');
    conv = await Conversation.create({
      instructor: instructorId,
      student: studentId,
      cohort: selectedCohortId,
      course: cohort?.course,
      lastMessageAt: new Date(),
      unreadCountInstructor: 0,
      unreadCountStudent: 0,
    });
    conv = await Conversation.findById(conv._id)
      .populate('student', 'name email externalStudentId')
      .populate('cohort', 'name')
      .populate('course', 'name code');
  }

  return conv;
}

/**
 * Get conversation by ID (with ownership check).
 */
async function getConversation(instructorId, conversationId) {
  return ownedConversation(instructorId, conversationId);
}

/**
 * List messages in a conversation (with ownership check).
 * Automatically marks unread student messages as read.
 */
async function listMessages(instructorId, conversationId, { limit = 100, before } = {}) {
  await ownedConversation(instructorId, conversationId);

  const filter = { conversation: conversationId };
  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const lim = Math.min(parseInt(limit, 10) || 100, 200);
  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();

  // Reverse so they are in chronological order (oldest -> newest)
  messages.reverse();

  // Mark all unread student messages as read
  await markAsRead(instructorId, conversationId);

  return { items: messages, total: messages.length };
}

/**
 * Send a message as an instructor.
 */
async function sendMessage(instructorId, conversationId, rawBody) {
  const conv = await ownedConversation(instructorId, conversationId);

  const body = String(rawBody || '').trim();
  if (!body) throw ApiError.badRequest('Message body cannot be empty');
  if (body.length > 2000) throw ApiError.badRequest('Message exceeds 2000 characters limit');

  const message = await Message.create({
    conversation: conversationId,
    senderRole: 'instructor',
    senderId: instructorId,
    body,
    read: false,
  });

  await Conversation.updateOne(
    { _id: conversationId },
    {
      lastMessage: {
        body,
        senderRole: 'instructor',
        senderId: instructorId,
        createdAt: message.createdAt,
      },
      lastMessageAt: message.createdAt,
      $inc: { unreadCountStudent: 1 },
    }
  );

  return message;
}

/**
 * Mark messages in a conversation as read by instructor.
 */
async function markAsRead(instructorId, conversationId) {
  await ownedConversation(instructorId, conversationId);

  const now = new Date();
  await Message.updateMany(
    { conversation: conversationId, senderRole: 'student', read: false },
    { $set: { read: true, readAt: now } }
  );

  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { unreadCountInstructor: 0 } }
  );

  return { marked: true };
}

/**
 * Get total unread message count for instructor.
 */
async function getUnreadCount(instructorId) {
  const r = await Conversation.aggregate([
    { $match: { instructor: new mongoose.Types.ObjectId(instructorId) } },
    { $group: { _id: null, total: { $sum: '$unreadCountInstructor' } } },
  ]);
  return { unreadCount: r[0]?.total || 0 };
}

// -------------------------------------------------------------
// Student-Side Integration Functions (Protected via API Key)
// -------------------------------------------------------------

async function studentGetByExternalId(externalStudentId) {
  let student = null;
  if (isId(String(externalStudentId))) {
    student = await StudentReference.findById(externalStudentId);
  }
  if (!student) {
    student = await StudentReference.findOne({ externalStudentId: String(externalStudentId) });
  }
  if (!student) throw ApiError.notFound('Student not found');
  return student;
}

async function studentListConversations(externalStudentId) {
  const student = await studentGetByExternalId(externalStudentId);
  const convs = await Conversation.find({ student: student._id })
    .populate('instructor', 'name email avatarUrl professional')
    .populate('cohort', 'name')
    .populate('course', 'name code')
    .sort({ lastMessageAt: -1 })
    .lean();
  return convs;
}

async function studentSendMessage(externalStudentId, conversationId, rawBody) {
  const student = await studentGetByExternalId(externalStudentId);
  if (!isId(String(conversationId))) throw ApiError.badRequest('Invalid conversationId');

  const conv = await Conversation.findOne({ _id: conversationId, student: student._id });
  if (!conv) throw ApiError.notFound('Conversation not found');

  const body = String(rawBody || '').trim();
  if (!body) throw ApiError.badRequest('Message body cannot be empty');
  if (body.length > 2000) throw ApiError.badRequest('Message exceeds 2000 characters limit');

  const message = await Message.create({
    conversation: conversationId,
    senderRole: 'student',
    senderId: student._id,
    body,
    read: false,
  });

  await Conversation.updateOne(
    { _id: conversationId },
    {
      lastMessage: {
        body,
        senderRole: 'student',
        senderId: student._id,
        createdAt: message.createdAt,
      },
      lastMessageAt: message.createdAt,
      $inc: { unreadCountInstructor: 1 },
    }
  );

  // Generate an instructor notification
  try {
    await Notification.create({
      user: conv.instructor,
      type: NOTIFICATION_TYPE.NEW_MESSAGE,
      title: `New message from ${student.name}`,
      message: body.slice(0, 100),
      link: `/instructor/messages/${conv._id}`,
    });
  } catch (err) {
    // Notification failure should not fail the message delivery
    console.error('Failed to create notification for message:', err.message);
  }

  return message;
}

async function studentListMessages(externalStudentId, conversationId, { limit = 100 } = {}) {
  const student = await studentGetByExternalId(externalStudentId);
  if (!isId(String(conversationId))) throw ApiError.badRequest('Invalid conversationId');

  const conv = await Conversation.findOne({ _id: conversationId, student: student._id });
  if (!conv) throw ApiError.notFound('Conversation not found');

  const lim = Math.min(parseInt(limit, 10) || 100, 200);
  const messages = await Message.find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();
  messages.reverse();

  // Mark instructor messages read for student
  await Message.updateMany(
    { conversation: conversationId, senderRole: 'instructor', read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { unreadCountStudent: 0 } }
  );

  return { items: messages, total: messages.length };
}

module.exports = {
  listConversations,
  getOrCreateConversation,
  getConversation,
  listMessages,
  sendMessage,
  markAsRead,
  getUnreadCount,
  studentListConversations,
  studentSendMessage,
  studentListMessages,
};
