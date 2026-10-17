const { Schema, model } = require('mongoose');
const { SUBMISSION_STATUS } = require('../config/constants');
const s = new Schema({
  externalSubmissionId: { type: String, index: true },
  assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
  cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: 'StudentReference', required: true },
  content: { type: String, trim: true, maxlength: 20000 },
  attachments: [{ name: String, url: String }],
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: Object.values(SUBMISSION_STATUS), default: SUBMISSION_STATUS.SUBMITTED, index: true },
}, { timestamps: true });
s.index({ assessment: 1, student: 1 }, { unique: true });
module.exports = model('AssessmentSubmission', s);
