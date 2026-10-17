const { Schema, model } = require('mongoose');
const { COHORT_STATUS } = require('../config/constants');
module.exports = model('Cohort', new Schema({
  externalCohortId: { type: String, index: true },
  name: { type: String, required: true, trim: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // the ASSIGNMENT
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: Object.values(COHORT_STATUS), default: COHORT_STATUS.UPCOMING },
}, { timestamps: true }));
