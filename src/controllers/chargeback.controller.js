import chargebackService from '../services/chargeback.service.js';
import {
  createChargebackSchema,
  resolveChargebackSchema,
  chargebackIdParamSchema,
  queryChargebacksSchema,
} from '../validators/chargeback.validator.js';

export async function getChargebacks(req, res, next) {
  try {
    const validated = queryChargebacksSchema.parse(req.query);
    const result = await chargebackService.getChargebacks(validated);

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getChargebackById(req, res, next) {
  try {
    const { id } = chargebackIdParamSchema.parse(req.params);
    const result = await chargebackService.getChargebackById(id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function createChargeback(req, res, next) {
  try {
    const validated = createChargebackSchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await chargebackService.createChargeback(
      validated,
      adminId,
      isOwner,
      ipAddress
    );

    return res.status(201).json({
      success: true,
      message: 'Chargeback dispute recorded successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function resolveChargeback(req, res, next) {
  try {
    const { id } = chargebackIdParamSchema.parse(req.params);
    const validated = resolveChargebackSchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await chargebackService.resolveChargeback({
      id,
      action: validated.action,
      adminNotes: validated.adminNotes,
      adminId,
      isOwner,
      ipAddress,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export default {
  getChargebacks,
  getChargebackById,
  createChargeback,
  resolveChargeback,
};
