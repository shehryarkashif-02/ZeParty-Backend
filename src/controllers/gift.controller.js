import giftRepository from '../repositories/gift.repository.js';
import giftService, { serializeGift } from '../services/gift.service.js';
import {
  createGiftSchema,
  updateGiftSchema,
  sendGiftSchema,
  queryGiftsSchema,
} from '../validators/gift.validator.js';

export async function getAdminGifts(req, res, next) {
  try {
    const validatedQuery = queryGiftsSchema.parse(req.query);
    const result = await giftRepository.findGifts(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Gifts retrieved successfully',
      data: result.gifts.map(serializeGift),
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function createGift(req, res, next) {
  try {
    const validatedData = createGiftSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const gift = await giftService.createGift(validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Gift created successfully in catalog',
      data: gift,
    });
  } catch (err) {
    next(err);
  }
}

export async function getGiftById(req, res, next) {
  try {
    const { id } = req.params;
    const gift = await giftService.getGiftDetails(id);

    return res.status(200).json({
      success: true,
      message: 'Gift details retrieved successfully',
      data: gift,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateGift(req, res, next) {
  try {
    const { id } = req.params;
    const validatedData = updateGiftSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updated = await giftService.updateGift(id, validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Gift updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteGift(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const deactivated = await giftService.deactivateGift(id, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Gift deactivated successfully',
      data: deactivated,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPublicGifts(req, res, next) {
  try {
    const validatedQuery = queryGiftsSchema.parse(req.query);
    const result = await giftService.getPublicGifts(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Active gifts retrieved successfully',
      data: result.gifts,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function sendGift(req, res, next) {
  try {
    const validatedData = sendGiftSchema.parse(req.body);
    const senderUserId = req.auth.userId;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await giftService.sendGift(
      {
        senderUserId,
        ...validatedData,
      },
      { ipAddress }
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getAdminGifts,
  createGift,
  getGiftById,
  updateGift,
  deleteGift,
  getPublicGifts,
  sendGift,
};
