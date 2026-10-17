const { Schema, model } = require('mongoose');
const { ATTENDANCE_STATUS } = require('../config/constants');

const s = new Schema({
  session: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: 'StudentReference', required: true },
  status: { type: String, enum: Object.values(ATTENDANCE_STATUS), default: ATTENDANCE_STATUS.PENDING },
  subStatus: { type: String, enum: ['none', 'late', 'excused'], default: 'none' },
  isLate: { type: Boolean, default: false },
  excused: { type: Boolean, default: false },
  markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  markedAt: { type: Date },
  qrCheckIn: {
    timestamp: { type: Date },
    method: { type: String, default: 'qr_code' },
    deviceInfo: { type: Schema.Types.Mixed },
    verified: { type: Boolean, default: false },
  },
  source: {
    type: String,
    enum: ['qr_checkin', 'instructor_manual', 'instructor_override', 'unrecorded'],
    default: 'unrecorded',
  },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, maxlength: 500 },
}, { timestamps: true });

s.index({ session: 1, student: 1 }, { unique: true });
module.exports = model('Attendance', s);
