// 📁 utils/socket.js
// Socket.IO singleton + JWT auth + broadcast helpers
'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./logger');

let io = null;

/**
 * Initialise Socket.IO on top of the existing HTTP server.
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || '*',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Optional JWT auth — if a token is supplied we attach the user payload
  // to the socket. Public sockets are still allowed (so storefront can also
  // listen to public events later if needed).
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization || '').replace('Bearer ', '');

      if (token && process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;

        // JWT only contains { id } — look up the user to get the role.
        let role = decoded?.role;
        if (!role && decoded?.id) {
          try {
            // Lazy-require to avoid circular deps at module load time.
            const User = require('../models/User');
            const u = await User.findById(decoded.id).select('role').lean();
            role = u?.role;
            if (role) socket.user.role = role;
          } catch (_) {}
        }
        if (role === 'admin') socket.join('admins');
      }
      return next();
    } catch (err) {
      // Invalid token — still allow as anonymous, just don't join admin room.
      return next();
    }
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 socket connected: ${socket.id} (user=${socket.user?.id || 'anon'})`);

    socket.on('join', (room) => {
      if (typeof room === 'string' && room.length < 80) socket.join(room);
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 socket disconnected: ${socket.id}`);
    });
  });

  logger.info('✅ Socket.IO initialised');
  return io;
}

function getIO() {
  return io;
}

/**
 * Emit a realtime event.
 *   resource — model / topic name (e.g. "Product", "Order")
 *   action   — "create" | "update" | "delete"
 *   payload  — small object (usually { id, doc? })
 *
 * Two events go out so listeners can subscribe broadly or narrowly:
 *   1. "resource:change"   (global firehose, admins-only)
 *   2. "<resource>:<action>" (specific, e.g. "Product:create")
 */
function emitChange(resource, action, payload = {}) {
  if (!io) return;
  const event = { resource, action, ...payload, at: Date.now() };
  io.to('admins').emit('resource:change', event);
  io.to('admins').emit(`${resource}:${action}`, event);
  // also emit a generic per-resource event for convenience
  io.to('admins').emit(`${resource}:change`, event);
}

module.exports = { initSocket, getIO, emitChange };
