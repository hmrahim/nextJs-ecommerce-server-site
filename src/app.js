'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');

const logger = require('./utils/logger');
const { ApiError } = require('./utils/apiHelpers');
const errorHandler = require('./middleware/errorHandler');
const router = require('./routes/routes');

const app = express();

/* ════════════════════════════════════════════════════
   GLOBAL MIDDLEWARE
════════════════════════════════════════════════════ */

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// NoSQL injection sanitizer  (strips $ and . from req.body / params / query)
app.use(mongoSanitize());

// Gzip compression
app.use(compression());
app.use('/api', require('./routes/index'));

// HTTP request logging  (skip in test env)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }));
}

// Global API rate limiter

// app.use(
//   '/api',
//   rateLimit({
//     windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
//     max: Number(process.env.RATE_LIMIT_MAX) || 100,
//     standardHeaders: true,
//     legacyHeaders: false,
//     message: { success: false, message: 'Too many requests. Please try again later.' },
//   })
// );

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
