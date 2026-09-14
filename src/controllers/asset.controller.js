import assetRepository from '../repositories/asset.repository.js';
import assetService, { serializeAsset } from '../services/asset.service.js';
import {
  createAssetSchema,
  updateAssetSchema,
  queryAssetsSchema,
} from '../validators/asset.validator.js';

export async function getAdminAssets(req, res, next) {
  try {
    const validatedQuery = queryAssetsSchema.parse(req.query);
    const result = await assetRepository.findAssets(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Assets retrieved successfully',
      data: result.assets.map(serializeAsset),
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function createAsset(req, res, next) {
  try {
    const validatedData = createAssetSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const asset = await assetService.createAsset(validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Asset created successfully in catalog',
      data: asset,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAssetById(req, res, next) {
  try {
    const { id } = req.params;
    const asset = await assetService.getAssetDetails(id);

    return res.status(200).json({
      success: true,
      message: 'Asset details retrieved successfully',
      data: asset,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAsset(req, res, next) {
  try {
    const { id } = req.params;
    const validatedData = updateAssetSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updated = await assetService.updateAsset(id, validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Asset updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAsset(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const deactivated = await assetService.deactivateAsset(id, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Asset deactivated successfully',
      data: deactivated,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyBackpack(req, res, next) {
  try {
    const userId = req.auth.userId;
    const backpack = await assetService.getUserBackpack(userId);

    return res.status(200).json({
      success: true,
      message: 'Backpack inventory retrieved successfully',
      data: backpack,
    });
  } catch (err) {
    next(err);
  }
}

export async function equipAsset(req, res, next) {
  try {
    const { id: userAssetId } = req.params;
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const equipped = await assetService.equipAsset(userId, userAssetId, { ipAddress });

    return res.status(200).json({
      success: true,
      message: 'Asset equipped successfully',
      data: equipped,
    });
  } catch (err) {
    next(err);
  }
}

export async function unequipAsset(req, res, next) {
  try {
    const { id: userAssetId } = req.params;
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const unequipped = await assetService.unequipAsset(userId, userAssetId, { ipAddress });

    return res.status(200).json({
      success: true,
      message: 'Asset unequipped successfully',
      data: unequipped,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getAdminAssets,
  createAsset,
  getAssetById,
  updateAsset,
  deleteAsset,
  getMyBackpack,
  equipAsset,
  unequipAsset,
};
