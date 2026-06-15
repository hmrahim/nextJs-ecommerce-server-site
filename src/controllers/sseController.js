// 📁 controllers/sse.controller.js

const { addClient, removeClient } = require('../utils/sseManager');

exports.categoryStream = (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // keep-alive ping প্রতি 30s
  const ping = setInterval(() => res.write(': ping\n\n'), 30000);

  addClient('categories', res);

  req.on('close', () => {
    clearInterval(ping);
    removeClient('categories', res);
  });
};

exports.orderStream = (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // keep-alive ping প্রতি 30s
  const ping = setInterval(() => res.write(': ping\n\n'), 30000);

  addClient('orders', res);

  req.on('close', () => {
    clearInterval(ping);
    removeClient('orders', res);
  });
};