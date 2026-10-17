const { Schema, model } = require('mongoose');
const { NOTIFICATION_TYPE } = require('../config/constants');
const s = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: Object.values(NOTIFICATION_TYPE), default: NOTIFICATION_TYPE.SYSTEM },
  title: { type: String, required: true },
  message: { type: String },
  link: { type: String },
  dedupeKey: { type: String },
  read: { type: Boolean, default: false },
  readAt: Date,
}, { timestamps: true });
s.index({ user: 1, dedupeKey: 1 });
module.exports = model('Notification', s);
