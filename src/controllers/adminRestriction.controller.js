import restrictionService from '../services/restriction.service.js';
import { applyRestrictionSchema, liftRestrictionSchema } from '../validators/restriction.validator.js';

export async function listRestrictions(req, res, next) {
  try {
    const { status, type, userId, search, page, limit } = req.query;
    const result = await restrictionService.listRestrictions(
      {
        status,
        type,
        userId,
        search,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: result.restrictions,
      meta: result.pagination,
    });
  } catch (err) {
    return next(err);
  }
}

export async function applyRestriction(req, res, next) {
  try {
    const validated = applyRestrictionSchema.parse(req.body);
    const restriction = await restrictionService.applyRestriction(
      {
        ...validated,
        createdByAdminId: req.admin?.id,
        adminName: req.admin?.name || req.admin?.username || 'Super Admin',
        ipAddress: req.ip,
      },
      req.db
    );

    return res.status(201).json({
      success: true,
      data: restriction,
      meta: {
        message: `Penalty applied successfully to ${validated.targetId}.`,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function liftRestriction(req, res, next) {
  try {
    const restrictionId = req.params.id;
    const validated = liftRestrictionSchema.parse(req.body || {});

    const updated = await restrictionService.liftRestriction(
      restrictionId,
      {
        liftReason: validated.liftReason || 'Administrative lifting of restriction',
        adminId: req.admin?.id,
        adminName: req.admin?.name || req.admin?.username || 'Super Admin',
        ipAddress: req.ip,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: updated,
      meta: {
        message: `Penalty "${restrictionId}" removed. Restriction lifted.`,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export default {
  listRestrictions,
  applyRestriction,
  liftRestriction,
};
