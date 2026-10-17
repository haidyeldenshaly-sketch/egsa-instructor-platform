const mongoose = require('mongoose');
const env = require('./env');
async function connectDB(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (err) => {
    if (env.nodeEnv !== 'test') console.error('MongoDB error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    if (env.nodeEnv !== 'test') console.warn('MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    if (env.nodeEnv !== 'test') console.log('MongoDB reconnected');
  });
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}
module.exports = { connectDB };
