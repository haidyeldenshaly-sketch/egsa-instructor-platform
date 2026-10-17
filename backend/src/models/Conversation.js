const { Schema, model } = require('mongoose');

const s = new Schema({
  instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: 'StudentReference', required: true, index: true },
  cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  lastMessage: {
    body: { type: String, trim: true },
    senderRole: { type: String, enum: ['instructor', 'student'] },
    senderId: { type: Schema.Types.ObjectId },
    createdAt: { type: Date },
  },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  unreadCountInstructor: { type: Number, default: 0 },
  unreadCountStudent: { type: Number, default: 0 },
}, { timestamps: true });

s.index({ instructor: 1, student: 1, cohort: 1 }, { unique: true });
s.index({ instructor: 1, lastMessageAt: -1 });
s.index({ student: 1, lastMessageAt: -1 });

module.exports = model('Conversation', s);
