import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import assetController from '../controllers/asset.controller.js';

export const adminAssetRouter = express.Router();
adminAssetRouter.use(authenticate);

adminAssetRouter.get('/', requirePermission('view_store'), assetController.getAdminAssets);
adminAssetRouter.post('/', requirePermission('manage_store'), assetController.createAsset);
adminAssetRouter.get('/:id', requirePermission('view_store'), assetController.getAssetById);
adminAssetRouter.put('/:id', requirePermission('manage_store'), assetController.updateAsset);
adminAssetRouter.delete('/:id', requirePermission('manage_store'), assetController.deleteAsset);

export const userBackpackRouter = express.Router();
userBackpackRouter.use(authenticate);

userBackpackRouter.get('/', assetController.getMyBackpack);
userBackpackRouter.post('/:id/equip', assetController.equipAsset);
userBackpackRouter.post('/:id/unequip', assetController.unequipAsset);

export default {
  adminAssetRouter,
  userBackpackRouter,
};
