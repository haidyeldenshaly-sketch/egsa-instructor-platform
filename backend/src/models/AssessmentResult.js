const { Schema, model } = require('mongoose');
const { RESULT_STATUS } = require('../config/constants');
// "Evaluation saved" (status=evaluated) is DISTINCT from "result published" (status=published).
module.exports = model('AssessmentResult', new Schema({
  submission: { type: Schema.Types.ObjectId, ref: 'AssessmentSubmission', required: true, unique: true },
  assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
  cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: 'StudentReference', required: true, index: true },
  score: { type: Number, min: 0 },
  feedback: { type: String, trim: true, maxlength: 5000 },
  strengths: { type: String, trim: true, maxlength: 3000 },
  improvements: { type: String, trim: true, maxlength: 3000 },
  status: { type: String, enum: Object.values(RESULT_STATUS), default: RESULT_STATUS.EVALUATED, index: true },
  evaluatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  evaluatedAt: Date,
  publishedAt: Date,
}, { timestamps: true }));
