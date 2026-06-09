'use strict';
require('dotenv').config();

const http      = require('http');
const app       = require('./app');
const connectDB = require('./config/database');
const logger    = require('./utils/logger');
const sockets   = require('./sockets');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();

  const server = http.createServer(app);
  sockets.init(server);

  server.listen(PORT, () => {
    logger.info(`🚀 Server started | mode: ${process.env.NODE_ENV || 'development'} | port: ${PORT}`);
    logger.info(`📡 Socket.IO ready`);
  });

  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed. Bye 👋');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason && reason.stack ? reason.stack : reason}`);
  });
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
    gracefulShutdown('uncaughtException');
  });
})();
