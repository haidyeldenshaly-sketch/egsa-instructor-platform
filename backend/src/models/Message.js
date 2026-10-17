const { Schema, model } = require('mongoose');

const s = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  senderRole: { type: String, enum: ['instructor', 'student'], required: true },
  senderId: { type: Schema.Types.ObjectId, required: true },
  body: { type: String, required: true, trim: true, maxlength: 3000 },
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
}, { timestamps: true });

s.index({ conversation: 1, createdAt: 1 });
s.index({ conversation: 1, read: 1 });

module.exports = model('Message', s);
