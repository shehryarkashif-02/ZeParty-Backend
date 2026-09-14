import giftService from '../services/gift.service.js';
import { SOCKET_EVENTS, SOCKET_ERRORS } from './socket.constants.js';
import { withRateLimit } from './rateLimiter.socket.js';

export async function onSendGift(io, socket, data, callback) {
  try {
    const roomId = data?.roomId;
    const recipientUserId = data?.recipientUserId;
    const giftId = data?.giftId;
    const quantity = Number(data?.quantity) || 1;

    if (!roomId || !recipientUserId || !giftId || quantity < 1) {
      const err = {
        success: false,
        error: {
          code: SOCKET_ERRORS.VALIDATION_ERROR,
          message: 'Valid roomId, recipientUserId, giftId, and positive quantity are required',
        },
      };
      if (typeof callback === 'function') return callback(err);
      return socket.emit(SOCKET_EVENTS.ERROR, err);
    }

    const senderUserId = socket.userId;

    if (senderUserId === recipientUserId) {
      const err = {
        success: false,
        error: { code: 'CANNOT_GIFT_SELF', message: 'Users cannot send gifts to themselves' },
      };
      if (typeof callback === 'function') return callback(err);
      return socket.emit(SOCKET_EVENTS.ERROR, err);
    }

    // Execute Phase 3 Authoritative Financial Gifting Transaction (wallet lock, split, ledger posting)
    const result = await giftService.sendGift(
      {
        senderUserId,
        recipientUserId,
        giftId,
        quantity,
        roomId,
      },
      {
        ipAddress: socket.handshake.address || '127.0.0.1',
      }
    );

    const giftData = result?.data || result;
    const transactionId = giftData?.transactionId || giftData?.transaction?.id || result?.giftTransaction?.id || 'tx_unknown';
    const giftInfo = giftData?.gift || result?.gift || {};

    // Build safe public broadcast payload (no private wallet balances or internal secrets)
    const broadcastPayload = {
      roomId,
      transactionId,
      sender: {
        id: socket.user.id,
        username: socket.user.username,
        displayName: socket.user.displayName,
        avatarUrl: socket.user.avatarUrl,
      },
      recipientUserId,
      gift: {
        id: giftInfo.id || giftId,
        name: giftInfo.name || 'Gift',
        iconUrl: giftInfo.iconUrl || null,
        animationUrl: giftInfo.animationUrl || giftInfo.svgaAssetUrl || null,
      },
      quantity,
      timestamp: new Date().toISOString(),
    };

    // Broadcast realtime event to the entire room strictly AFTER DB transaction commits
    io.to(`room:${roomId}`).emit(SOCKET_EVENTS.ROOM_GIFT_SENT, broadcastPayload);

    if (typeof callback === 'function') {
      return callback({
        success: true,
        message: 'Gift sent successfully.',
        data: broadcastPayload,
      });
    }
  } catch (err) {
    const errorResponse = {
      success: false,
      error: {
        code: err.code || SOCKET_ERRORS.INTERNAL_ERROR,
        message: err.message || 'Failed to send gift',
      },
    };
    if (typeof callback === 'function') return callback(errorResponse);
    socket.emit(SOCKET_EVENTS.ERROR, errorResponse);
  }
}

export function registerGiftHandlers(io, socket) {
  socket.on(
    SOCKET_EVENTS.ROOM_GIFT_SEND,
    withRateLimit('GIFT_ACTION', 5, 1000, (s, d, cb) => onSendGift(io, s, d, cb))
  );
}

export default {
  onSendGift,
  registerGiftHandlers,
};
