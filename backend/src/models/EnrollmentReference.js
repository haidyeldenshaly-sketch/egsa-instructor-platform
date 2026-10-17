const { Schema, model } = require('mongoose');
const { ENROLLMENT_STATUS } = require('../config/constants');
const s = new Schema({
  externalEnrollmentId: { type: String, index: true },
  student: { type: Schema.Types.ObjectId, ref: 'StudentReference', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true, index: true },
  status: { type: String, enum: Object.values(ENROLLMENT_STATUS), default: ENROLLMENT_STATUS.ACTIVE },
}, { timestamps: true });
s.index({ student: 1, cohort: 1 }, { unique: true });
module.exports = model('EnrollmentReference', s);
