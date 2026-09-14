import pkService from '../services/pk.service.js';

export function registerPKHandlers(io, socket) {
  // Start PK Battle via WebSocket
  socket.on('pk:start', async (data, callback) => {
    try {
      const { roomAId, roomBId, hostAUserId, hostBUserId, durationSeconds } = data || {};
      const pkEvent = await pkService.startPK({
        roomAId,
        roomBId,
        hostAUserId,
        hostBUserId,
        durationSeconds,
      });

      if (typeof callback === 'function') {
        callback({ success: true, data: pkEvent });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message, code: err.code || 'PK_START_FAILED' });
      }
    }
  });

  // Activate PK Battle after countdown
  socket.on('pk:activate', async (data, callback) => {
    try {
      const { pkId } = data || {};
      const pkEvent = await pkService.activatePK(pkId);
      if (typeof callback === 'function') {
        callback({ success: true, data: pkEvent });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // End PK Battle
  socket.on('pk:end', async (data, callback) => {
    try {
      const { pkId } = data || {};
      const pkEvent = await pkService.endPK(pkId);
      if (typeof callback === 'function') {
        callback({ success: true, data: pkEvent });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });
}

export default registerPKHandlers;
