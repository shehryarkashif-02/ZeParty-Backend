/**
 * Canonical Realtime Socket.IO Event Constants and Error Codes
 */

export const SOCKET_EVENTS = {
  // Connection & Core
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Room Lifecycle & Subscription
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_SNAPSHOT: 'room:snapshot',
  ROOM_USER_JOINED: 'room:user_joined',
  ROOM_USER_LEFT: 'room:user_left',
  ROOM_VIEWER_COUNT_CHANGED: 'room:viewer_count_changed',
  ROOM_CREATED: 'room:created',
  ROOM_STARTED: 'room:started',
  ROOM_CLOSED: 'room:closed',

  // Seat Management
  ROOM_SEAT_OCCUPY: 'room:seat_occupy',
  ROOM_SEAT_LEAVE: 'room:seat_leave',
  ROOM_SEAT_OCCUPIED: 'room:seat_occupied',
  ROOM_SEAT_RELEASED: 'room:seat_released',
  ROOM_SEAT_UPDATED: 'room:seat_updated',

  // Admin Controls
  ROOM_PINNED: 'room:pinned',
  ROOM_UNPINNED: 'room:unpinned',

  // Gifting & Tipping
  ROOM_GIFT_SEND: 'room:gift_send',
  ROOM_GIFT_SENT: 'room:gift_sent',

  // PK Battles (Phase 19)
  PK_START: 'pk:start',
  PK_STARTED: 'pk:started',
  PK_ACTIVATE: 'pk:activate',
  PK_ACTIVE: 'pk:active',
  PK_SCORE_UPDATED: 'pk:score_updated',
  PK_END: 'pk:end',
  PK_ENDED: 'pk:ended',

  // Settlements & Payroll
  SETTLEMENT_CREATED: 'settlement:created',
  SETTLEMENT_CALCULATED: 'settlement:calculated',
  SETTLEMENT_APPROVED: 'settlement:approved',
  SETTLEMENT_PAID: 'settlement:paid',
  SETTLEMENT_ADJUSTED: 'settlement:adjusted',

  // Social & Community
  POST_CREATED: 'post:created',
  POST_DELETED: 'post:deleted',
  POST_LIKED: 'post:liked',
  POST_UNLIKED: 'post:unliked',
  COMMENT_CREATED: 'comment:created',
  COMMENT_DELETED: 'comment:deleted',
  FOLLOW_CREATED: 'follow:created',
  FOLLOW_REMOVED: 'follow:removed',

  // Moderation, Safety & Restrictions (Phase 8)
  MODERATION_RESTRICTION: 'moderation:restriction',
  MODERATION_BAN: 'moderation:ban',
  MODERATION_UNBAN: 'moderation:unban',
  MODERATION_ACTION: 'moderation:action',
  REPORT_CREATED: 'report:created',
  REPORT_UPDATED: 'report:updated',
  REPORT_RESOLVED: 'report:resolved',
  TICKET_CREATED: 'ticket:created',
  TICKET_UPDATED: 'ticket:updated',
  TICKET_MESSAGE: 'ticket:message',
  TICKET_ASSIGNED: 'ticket:assigned',
  TICKET_RESOLVED: 'ticket:resolved',

  // Notifications & FCM Delivery (Phase 9)
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_READ_ALL: 'notification:read_all',
  NOTIFICATION_BROADCAST: 'notification:broadcast',
};

export const SOCKET_ERRORS = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  USER_NOT_ACTIVE: 'USER_NOT_ACTIVE',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_NOT_LIVE: 'ROOM_NOT_LIVE',
  INVALID_SEAT_INDEX: 'INVALID_SEAT_INDEX',
  SEAT_OCCUPIED: 'SEAT_OCCUPIED',
  SEAT_RELEASE_DENIED: 'SEAT_RELEASE_DENIED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export default {
  SOCKET_EVENTS,
  SOCKET_ERRORS,
};
