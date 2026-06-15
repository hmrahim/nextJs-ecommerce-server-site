
const dns = require('dns')
dns.setServers(['8.8.8.8', '8.8.4.4'])


const mongoose = require('mongoose');
const logger   = require('../utils/logger');
const realtimePlugin = require('../utils/realtimePlugin');

// 🔴 Register realtime plugin globally BEFORE any model is compiled.
// Every schema created afterwards will emit socket events on CRUD.
mongoose.plugin(realtimePlugin);

const MONGO_OPTIONS = {
  autoIndex: process.env.NODE_ENV !== 'production',
};

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    logger.error('MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, MONGO_OPTIONS);
    logger.info(`✅ MongoDB connected → ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    logger.error(`❌ MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => logger.warn('⚠️  MongoDB disconnected.'));
  mongoose.connection.on('reconnected',  () => logger.info('✅ MongoDB reconnected.'));
  mongoose.connection.on('error', (err)  => logger.error(`MongoDB error: ${err.message}`));
};

module.exports = connectDB;
