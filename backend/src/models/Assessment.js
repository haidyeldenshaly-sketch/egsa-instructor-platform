const { Schema, model } = require('mongoose');
const { ASSESSMENT_STATUS } = require('../config/constants');
module.exports = model('Assessment', new Schema({
  externalAssessmentId: { type: String, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 3000 },
  instructions: { type: String, trim: true, maxlength: 5000 },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true, index: true },
  startDate: { type: Date },
  dueDate: { type: Date },
  attachments: [{ name: String, url: String }],
  // Configurable grading structure: NO default maxScore / pass mark is invented.
  gradingConfig: { maxScore: { type: Number, min: 0, default: null } },
  status: { type: String, enum: Object.values(ASSESSMENT_STATUS), default: ASSESSMENT_STATUS.DRAFT, index: true },
  publishedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true }));
