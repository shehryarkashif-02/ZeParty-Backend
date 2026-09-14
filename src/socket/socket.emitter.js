let ioInstance = null;

/**
 * Sets the global Socket.IO server instance.
 */
export function setSocketServerInstance(io) {
  ioInstance = io;
}

/**
 * Gets the global Socket.IO server instance.
 */
export function getSocketServerInstance() {
  return ioInstance;
}

/**
 * Emits an event to all connected sockets in a specific room.
 * 
 * @param {string} roomId - Room identifier
 * @param {string} event - Event name from SOCKET_EVENTS
 * @param {Object} payload - Event payload
 */
export function emitToRoom(roomId, event, payload) {
  if (!ioInstance || !roomId) return false;
  try {
    ioInstance.to(`room:${roomId}`).emit(event, payload);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Emits an event to all connected sockets for a specific user.
 * 
 * @param {string} userId - User identifier
 * @param {string} event - Event name from SOCKET_EVENTS
 * @param {Object} payload - Event payload
 */
export function emitToUser(userId, event, payload) {
  if (!ioInstance || !userId) return false;
  try {
    ioInstance.to(`user:${userId}`).emit(event, payload);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Broadcasts an event globally to all connected sockets on the server.
 * 
 * @param {string} event - Event name
 * @param {Object} payload - Event payload
 */
export function broadcastGlobal(event, payload) {
  if (!ioInstance) return false;
  try {
    ioInstance.emit(event, payload);
    return true;
  } catch (err) {
    return false;
  }
}

export const emitToAll = broadcastGlobal;

export default {
  setSocketServerInstance,
  getSocketServerInstance,
  emitToRoom,
  emitToUser,
  broadcastGlobal,
  emitToAll,
};
