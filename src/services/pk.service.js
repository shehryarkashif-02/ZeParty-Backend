import socketEmitter from '../socket/socket.emitter.js';

export class PKService {
  constructor(repo = null) {
    this.customRepo = repo;
  }

  async getRepo() {
    if (this.customRepo) return this.customRepo;
    const module = await import('../repositories/pk.repository.js');
    return module.default;
  }

  /**
   * Start a new PK battle between two active live rooms.
   */
  async startPK({ roomAId, roomBId, hostAUserId, hostBUserId, durationSeconds = 300 }) {
    if (!roomAId || !roomBId) {
      const error = new Error('Both roomAId and roomBId are required to initiate PK battle.');
      error.status = 400;
      error.code = 'INVALID_PK_PARTICIPANTS';
      throw error;
    }

    if (roomAId === roomBId) {
      const error = new Error('A room cannot start a PK battle with itself.');
      error.status = 400;
      error.code = 'SAME_ROOM_PK';
      throw error;
    }

    const repo = await this.getRepo();

    // Check if either room already has an active PK battle
    const [existingPKA, existingPKB] = await Promise.all([
      repo.findActivePKForRoom(roomAId),
      repo.findActivePKForRoom(roomBId),
    ]);

    if (existingPKA || existingPKB) {
      const error = new Error('One or both rooms are already in an active PK battle.');
      error.status = 409;
      error.code = 'PK_ALREADY_ACTIVE';
      throw error;
    }

    const pkEvent = await repo.createPKEvent({
      roomAId,
      roomBId,
      hostAUserId,
      hostBUserId,
      durationSeconds,
    });

    // Broadcast PK started event to both rooms via Socket.IO
    socketEmitter.emitToRoom(roomAId, 'pk:started', {
      pkId: pkEvent.id,
      roomAId,
      roomBId,
      durationSeconds,
      status: 'COUNTDOWN',
    });

    socketEmitter.emitToRoom(roomBId, 'pk:started', {
      pkId: pkEvent.id,
      roomAId,
      roomBId,
      durationSeconds,
      status: 'COUNTDOWN',
    });

    return pkEvent;
  }

  /**
   * Transition PK battle from COUNTDOWN to ACTIVE.
   */
  async activatePK(pkId) {
    const repo = await this.getRepo();
    const pkEvent = await repo.findPKEventById(pkId);
    if (!pkEvent) {
      const error = new Error('PK battle not found.');
      error.status = 404;
      error.code = 'PK_NOT_FOUND';
      throw error;
    }

    if (pkEvent.status !== 'COUNTDOWN') {
      return pkEvent;
    }

    const updated = await repo.updatePKStatus(pkId, { status: 'ACTIVE' });

    socketEmitter.emitToRoom(pkEvent.roomAId, 'pk:active', { pkId, status: 'ACTIVE' });
    socketEmitter.emitToRoom(pkEvent.roomBId, 'pk:active', { pkId, status: 'ACTIVE' });

    return updated;
  }

  /**
   * Accumulate PK battle score upon live gift sending.
   */
  async addPKScore({ roomId, giftCoinValue }) {
    const repo = await this.getRepo();
    const activePK = await repo.findActivePKForRoom(roomId);
    if (!activePK || activePK.status !== 'ACTIVE') {
      return null;
    }

    const isHostA = activePK.roomAId === roomId;
    const hostKey = isHostA ? 'hostA' : 'hostB';

    const updated = await repo.incrementHostScore(activePK.id, hostKey, giftCoinValue);

    const scorePayload = {
      pkId: activePK.id,
      hostAScore: updated.hostAScore.toString(),
      hostBScore: updated.hostBScore.toString(),
      recentGiftCoins: giftCoinValue,
      scoredRoomId: roomId,
    };

    socketEmitter.emitToRoom(activePK.roomAId, 'pk:score_updated', scorePayload);
    socketEmitter.emitToRoom(activePK.roomBId, 'pk:score_updated', scorePayload);

    return updated;
  }

  /**
   * Conclude PK battle and determine winner.
   */
  async endPK(pkId) {
    const repo = await this.getRepo();
    const pkEvent = await repo.findPKEventById(pkId);
    if (!pkEvent) {
      const error = new Error('PK battle not found.');
      error.status = 404;
      error.code = 'PK_NOT_FOUND';
      throw error;
    }

    if (pkEvent.status === 'ENDED') {
      return pkEvent;
    }

    let winnerHostUserId = null;
    if (pkEvent.hostAScore > pkEvent.hostBScore) {
      winnerHostUserId = pkEvent.hostAUserId;
    } else if (pkEvent.hostBScore > pkEvent.hostAScore) {
      winnerHostUserId = pkEvent.hostBUserId;
    } // null represents a draw/tie

    const updated = await repo.updatePKStatus(pkId, {
      status: 'ENDED',
      winnerHostUserId,
      endedAt: new Date(),
    });

    const endPayload = {
      pkId: pkEvent.id,
      status: 'ENDED',
      winnerHostUserId,
      isTie: winnerHostUserId === null,
      hostAScore: pkEvent.hostAScore.toString(),
      hostBScore: pkEvent.hostBScore.toString(),
    };

    socketEmitter.emitToRoom(pkEvent.roomAId, 'pk:ended', endPayload);
    socketEmitter.emitToRoom(pkEvent.roomBId, 'pk:ended', endPayload);

    return updated;
  }

  /**
   * Get active PK status for a live room.
   */
  async getRoomPKStatus(roomId) {
    const repo = await this.getRepo();
    const activePK = await repo.findActivePKForRoom(roomId);
    return activePK || null;
  }

  /**
   * List PK events for Admin oversight.
   */
  async listAdminPKEvents(params) {
    const repo = await this.getRepo();
    return repo.listPKEvents(params);
  }
}

export const pkService = new PKService();
export default pkService;
