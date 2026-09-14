import storeService from '../services/store.service.js';
import { purchaseAssetSchema } from '../validators/asset.validator.js';
import { queryStoreCatalogSchema } from '../validators/store.validator.js';

export async function getAdminStoreCatalog(req, res, next) {
  try {
    const validatedQuery = queryStoreCatalogSchema.parse(req.query);
    const result = await storeService.getStoreCatalog(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Store catalog retrieved successfully',
      data: result.assets,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminVipStore(req, res, next) {
  try {
    const validatedQuery = queryStoreCatalogSchema.parse(req.query);
    const result = await storeService.getVipStoreCatalog(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'VIP store catalog retrieved successfully',
      data: result.assets,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPublicStoreCatalog(req, res, next) {
  try {
    const validatedQuery = queryStoreCatalogSchema.parse(req.query);
    const result = await storeService.getStoreCatalog(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Store catalog retrieved successfully',
      data: result.assets,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function purchaseAsset(req, res, next) {
  try {
    const validatedData = purchaseAssetSchema.parse(req.body);
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await storeService.purchaseAsset(
      {
        userId,
        assetId: validatedData.assetId,
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
  getAdminStoreCatalog,
  getAdminVipStore,
  getPublicStoreCatalog,
  purchaseAsset,
};
