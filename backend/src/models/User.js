const { Schema, model } = require('mongoose');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: Object.values(ROLES), required: true, default: ROLES.INSTRUCTOR },
  phone: { type: String, trim: true, maxlength: 30 },
  professional: {
    title: { type: String, trim: true, maxlength: 120 },
    organization: { type: String, trim: true, maxlength: 160 },
    expertise: { type: String, trim: true, maxlength: 500 },
  },
  preferredLanguage: { type: String, enum: ['en', 'ar'], default: 'en' },
  avatarUrl: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: Object.values(ACCOUNT_STATUS), default: ACCOUNT_STATUS.ACTIVE },
  refreshTokenHashes: { type: [String], select: false, default: [] }, // one per active session/device (max 5)
  passwordResetHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
}, { timestamps: true });
userSchema.methods.toSafe = function () {
  const o = this.toObject();
  delete o.passwordHash; delete o.refreshTokenHashes; delete o.passwordResetHash; delete o.passwordResetExpires; delete o.__v;
  return o;
};
module.exports = model('User', userSchema);
