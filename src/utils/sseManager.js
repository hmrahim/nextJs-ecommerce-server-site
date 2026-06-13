// 📁 utils/sseManager.js

const clients = new Map(); // room → Set of res objects

const addClient = (room, res) => {
  if (!clients.has(room)) clients.set(room, new Set());
  clients.get(room).add(res);
};

const removeClient = (room, res) => {
  clients.get(room)?.delete(res);
};

const broadcast = (room, event, data = {}) => {
  const roomClients = clients.get(room);
  if (!roomClients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  roomClients.forEach(res => res.write(payload));
};

module.exports = { addClient, removeClient, broadcast };