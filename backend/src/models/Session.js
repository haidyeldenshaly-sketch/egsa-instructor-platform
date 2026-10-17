const { Schema, model } = require('mongoose');
const { SESSION_STATUS } = require('../config/constants');
const s = new Schema({
  externalSessionId: { type: String, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000 },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true, index: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  startsAt: { type: Date, index: true },
  location: { type: String, trim: true, maxlength: 200 },
  onlineUrl: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: Object.values(SESSION_STATUS), default: SESSION_STATUS.SCHEDULED },
}, { timestamps: true });
s.pre('validate', function (next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate('endTime', 'endTime must be after startTime'); // -> ValidationError -> HTTP 400
  }
  if (this.date && this.startTime) {
    const d = new Date(this.date);
    const [h, m] = this.startTime.split(':').map(Number);
    d.setUTCHours(h, m, 0, 0);
    this.startsAt = d;
  }
  next();
});
module.exports = model('Session', s);
