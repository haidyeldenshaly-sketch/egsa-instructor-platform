const bcrypt = require('bcryptjs');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { pick } = require('../utils/helpers');
// Only allow-listed fields; role/status/permissions can never be changed here (mass-assignment safe).
const EDITABLE = ['name', 'phone', 'professional', 'preferredLanguage', 'avatarUrl'];
async function get(id) { return (await User.findById(id)).toSafe(); }
async function update(id, body) {
  const u = await User.findById(id);
  const data = pick(body, EDITABLE);
  if (data.professional) data.professional = pick(data.professional, ['title', 'organization', 'expertise']);
  Object.assign(u, data); await u.save(); return u.toSafe();
}
async function uploadAvatar(id, avatarUrl) {
  const u = await User.findById(id);
  if (!u) throw ApiError.notFound('User not found');
  u.avatarUrl = avatarUrl;
  await u.save();
  return u.toSafe();
}
async function deleteAvatar(id) {
  const u = await User.findById(id);
  if (!u) throw ApiError.notFound('User not found');
  u.avatarUrl = null;
  await u.save();
  return u.toSafe();
}
async function changePassword(id, { currentPassword, newPassword }) {
  const u = await User.findById(id).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword, u.passwordHash))) throw ApiError.badRequest('Current password is incorrect');
  u.passwordHash = await bcrypt.hash(newPassword, 12); u.refreshTokenHashes = []; await u.save();
}
module.exports = { get, update, uploadAvatar, deleteAvatar, changePassword };
