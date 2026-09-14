import merchantRepository from '../repositories/merchant.repository.js';
import merchantService, { sanitizeMerchant } from '../services/merchant.service.js';
import {
  createMerchantSchema,
  updateMerchantSchema,
  queryMerchantsSchema,
} from '../validators/merchant.validator.js';

export async function getMerchants(req, res, next) {
  try {
    const validatedQuery = queryMerchantsSchema.parse(req.query);
    const result = await merchantRepository.findMerchants(validatedQuery);

    const sanitized = result.merchants.map(sanitizeMerchant);

    return res.status(200).json({
      success: true,
      message: 'Merchants retrieved successfully',
      data: sanitized,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function createMerchant(req, res, next) {
  try {
    const validatedData = createMerchantSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await merchantService.createMerchant(validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Merchant account created and API credentials generated successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMerchantById(req, res, next) {
  try {
    const { id } = req.params;
    const merchant = await merchantService.getMerchantDetails(id);

    return res.status(200).json({
      success: true,
      message: 'Merchant details retrieved successfully',
      data: merchant,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMerchant(req, res, next) {
  try {
    const { id } = req.params;
    const validatedData = updateMerchantSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updated = await merchantService.updateMerchant(id, validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Merchant updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getMerchants,
  createMerchant,
  getMerchantById,
  updateMerchant,
};
