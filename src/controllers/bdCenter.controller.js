import bdCenterRepository from '../repositories/bdCenter.repository.js';
import bdCenterService from '../services/bdCenter.service.js';
import {
  createBDCenterSchema,
  updateBDCenterSchema,
  createBDInviteSchema,
  acceptBDInviteSchema,
  queryBDCentersSchema,
} from '../validators/bdCenter.validator.js';

export async function validateInvite(req, res, next) {
  try {
    const { code } = req.params;
    const invite = await bdCenterService.validateInviteCode(code);

    return res.status(200).json({
      success: true,
      message: 'Invitation code is valid',
      data: invite,
    });
  } catch (err) {
    next(err);
  }
}

export async function acceptInvite(req, res, next) {
  try {
    const validatedData = acceptBDInviteSchema.parse(req.body);
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await bdCenterService.acceptBDInvite(
      validatedData.invitationCode,
      userId,
      { ipAddress }
    );

    return res.status(200).json({
      success: true,
      message: 'BD Center invitation accepted successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getBDCenters(req, res, next) {
  try {
    const validatedQuery = queryBDCentersSchema.parse(req.query);
    const result = await bdCenterRepository.findBDCenters(validatedQuery);

    const serializedCenters = result.centers.map((c) => ({
      ...c,
      totalGroupDiamondsMonth: c.totalGroupDiamondsMonth ? c.totalGroupDiamondsMonth.toString() : '0',
    }));

    return res.status(200).json({
      success: true,
      message: 'BD Centers retrieved successfully',
      data: serializedCenters,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function createBDCenter(req, res, next) {
  try {
    const validatedData = createBDCenterSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const center = await bdCenterService.createBDCenter(validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'BD Center created successfully',
      data: center,
    });
  } catch (err) {
    next(err);
  }
}

export async function getBDCenterById(req, res, next) {
  try {
    const { id } = req.params;
    const center = await bdCenterService.getBDCenterDetails(id);

    return res.status(200).json({
      success: true,
      message: 'BD Center details retrieved successfully',
      data: center,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateBDCenter(req, res, next) {
  try {
    const { id } = req.params;
    const validatedData = updateBDCenterSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updated = await bdCenterService.updateBDCenter(id, validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'BD Center updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function sendInvite(req, res, next) {
  try {
    const { id: bdCenterId } = req.params;
    const { targetUserId } = req.body;
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const validatedData = createBDInviteSchema.parse({ bdCenterId, targetUserId });

    const invite = await bdCenterService.sendBDInvite(validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'BD Center invitation sent successfully',
      data: invite,
    });
  } catch (err) {
    next(err);
  }
}

export async function getBDCenterInvites(req, res, next) {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;

    const result = await bdCenterRepository.findInvitesByCenter(id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return res.status(200).json({
      success: true,
      message: 'BD Center invitations retrieved successfully',
      data: result.invites,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  validateInvite,
  acceptInvite,
  getBDCenters,
  createBDCenter,
  getBDCenterById,
  updateBDCenter,
  sendInvite,
  getBDCenterInvites,
};
