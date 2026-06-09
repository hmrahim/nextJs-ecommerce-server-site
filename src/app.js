'use strict';

const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const morgan         = require('morgan');
const rateLimit      = require('express-rate-limit');
const mongoSanitize  = require('express-mongo-sanitize');
const compression    = require('compression');
const cookieParser   = require('cookie-parser');

const logger         = require('./utils/logger');
const { ApiError }   = require('./utils/apiHelpers');
const errorHandler   = require('./middleware/errorHandler');

const router         = require('./routes/routes');
const stripeWebhook  = require('./webhooks/stripe.webhook');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

/* ═════════════ STRIPE WEBHOOK — RAW BODY (MUST be before json parser) ═════════════ */
app.use('/api/webhooks/stripe', stripeWebhook);

/* ═════════════ GLOBAL MIDDLEWARE ═════════════ */
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(compression());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }));
}

// Global API rate limiter
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      Number(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', limiter);

/* ═════════════ HEALTH CHECK ═════════════ */
app.get('/health', (_req, res) => res.status(200).json({
  status: 'ok',
  env: process.env.NODE_ENV,
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

/* ═════════════ MOUNT ROUTES ═════════════ */
app.use('/api', router);

/* ═════════════ 404 + ERROR HANDLERS ═════════════ */
app.use((req, _res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`)));
app.use(errorHandler);

module.exports = app;
