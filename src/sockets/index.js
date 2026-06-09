'use strict';
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io;

function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : '*',
      credentials: true,
    },
  });

  // Optional auth — clients can connect anonymously for public namespaces
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next();
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
    } catch (_) {
      // ignore invalid token — connection stays anonymous
    }
    next();
  });

  io.on('connection', (socket) => {
    logger.info(`socket connected: ${socket.id} user=${socket.user?.id || 'guest'}`);

    // Personal room — for notifications
    if (socket.user?.id) socket.join(`user:${socket.user.id}`);

    // Admin room
    if (socket.user?.role === 'admin') socket.join('admins');

    socket.on('chat:join', (roomId) => {
      if (!roomId) return;
      socket.join(`chat:${roomId}`);
      socket.to(`chat:${roomId}`).emit('chat:user-joined', { userId: socket.user?.id });
    });

    socket.on('chat:message', (payload) => {
      const { roomId, message } = payload || {};
      if (!roomId || !message) return;
      io.to(`chat:${roomId}`).emit('chat:message', {
        roomId, message, from: socket.user?.id || 'guest', at: Date.now(),
      });
    });

    socket.on('tracking:subscribe', (orderId) => {
      if (orderId) socket.join(`tracking:${orderId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`socket disconnected: ${socket.id} reason=${reason}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialised yet');
  return io;
}

// Convenience emit helpers used by services
const emit = {
  toUser:  (userId, event, data) => io && io.to(`user:${userId}`).emit(event, data),
  toAdmins:(event, data)         => io && io.to('admins').emit(event, data),
  toChat:  (roomId, event, data) => io && io.to(`chat:${roomId}`).emit(event, data),
  toOrder: (orderId, event, data)=> io && io.to(`tracking:${orderId}`).emit(event, data),
  broadcast:(event, data)        => io && io.emit(event, data),
};

module.exports = { init, getIO, emit };
