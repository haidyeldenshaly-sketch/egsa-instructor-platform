const { Schema, model } = require('mongoose');
module.exports = model('ActivityLog', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  entityType: String,
  entityId: Schema.Types.ObjectId,
  summary: String,
}, { timestamps: { createdAt: true, updatedAt: false } }));
