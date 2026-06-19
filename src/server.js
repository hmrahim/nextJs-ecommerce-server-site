
/* ── Load env vars FIRST — before any other require ─────── */
require('dotenv').config();

const http      = require('http');
const app       = require('./app');
const connectDB = require('./config/database');
const logger    = require('./utils/logger');
const { initSocket } = require('./utils/socket');

const PORT = process.env.PORT || 5000;
console.log('MONGO_URI:', process.env.MONGO_URI ? 'পাওয়া গেছে ✅' : 'পাওয়া যায়নি ❌'); // ← এটা add করো

/* ════════════════════════════════════════════════════
   BOOTSTRAP
════════════════════════════════════════════════════ */
(async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Create HTTP server + attach Socket.IO
  const server = http.createServer(app);
  initSocket(server);

  // 3. Start listening
  server.listen(PORT, () => {
    logger.info(`🚀 Server started | mode: ${process.env.NODE_ENV} | port: ${PORT}`);
    logger.info(`📡 Socket.IO ready on ws://localhost:${PORT}`);
  });

  /* ── Graceful shutdown ───────────────────────────────────── */
  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed. Bye 👋');
      process.exit(0);
    });

    // Force-kill if server hasn't closed within 10 s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

  /* ── Unhandled promise rejections ────────────────────────── */
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
    gracefulShutdown('unhandledRejection');
  });

  /* ── Uncaught exceptions ─────────────────────────────────── */
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
    gracefulShutdown('uncaughtException');
  });
})();
