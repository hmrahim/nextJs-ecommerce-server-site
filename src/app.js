'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');

const logger = require('./utils/logger');
const { ApiError } = require('./utils/apiHelpers');
const errorHandler = require('./middleware/errorHandler');

const app = express();

/* ════════════════════════════════════════════════════
   GLOBAL MIDDLEWARE
════════════════════════════════════════════════════ */
app.use(helmet());

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://www.moom24.com',
        'https://moom24.com',
        process.env.CLIENT_ORIGIN,
      ].filter(Boolean);

      // Postman বা server-to-server call এর জন্য (origin নেই)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(compression());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }));
}

/* ════════════════════════════════════════════════════
   ROUTES
════════════════════════════════════════════════════ */
app.use('/api', require('./routes/index'));

/* ════════════════════════════════════════════════════
   HEALTH CHECK
════════════════════════════════════════════════════ */
app.get('/health', (_req, res) =>
  res.status(200).json({
    status: 'ok',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
);

/* ════════════════════════════════════════════════════
   404 & ERROR HANDLERS  (must be last)
════════════════════════════════════════════════════ */
app.use((req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
});

app.use(errorHandler);

module.exports = app;
