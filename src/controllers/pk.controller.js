import pkService from '../services/pk.service.js';

export async function startPK(req, res, next) {
  try {
    const { roomAId, roomBId, hostAUserId, hostBUserId, durationSeconds } = req.body;
    const pkEvent = await pkService.startPK({
      roomAId,
      roomBId,
      hostAUserId,
      hostBUserId,
      durationSeconds,
    });

    return res.status(201).json({
      success: true,
      data: pkEvent,
      message: 'PK battle initiated successfully in countdown state.',
    });
  } catch (error) {
    next(error);
  }
}

export async function getRoomPKStatus(req, res, next) {
  try {
    const { roomId } = req.params;
    const activePK = await pkService.getRoomPKStatus(roomId);

    return res.status(200).json({
      success: true,
      data: activePK,
    });
  } catch (error) {
    next(error);
  }
}

export async function endPK(req, res, next) {
  try {
    const { id } = req.params;
    const pkEvent = await pkService.endPK(id);

    return res.status(200).json({
      success: true,
      data: pkEvent,
      message: 'PK battle concluded successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function listAdminPKEvents(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const result = await pkService.listAdminPKEvents({ page, limit, status });

    return res.status(200).json({
      success: true,
      data: result.events,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (error) {
    next(error);
  }
}

export default {
  startPK,
  getRoomPKStatus,
  endPK,
  listAdminPKEvents,
};
