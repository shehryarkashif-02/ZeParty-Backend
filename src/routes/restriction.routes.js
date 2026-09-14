import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import adminRestrictionController from '../controllers/adminRestriction.controller.js';

export const adminRestrictionRouter = express.Router();

adminRestrictionRouter.get('/', authenticate, requirePermission('manage_restrictions'), adminRestrictionController.listRestrictions);
adminRestrictionRouter.post('/', authenticate, requirePermission('manage_restrictions'), adminRestrictionController.applyRestriction);
adminRestrictionRouter.delete('/:id', authenticate, requirePermission('manage_restrictions'), adminRestrictionController.liftRestriction);

export default adminRestrictionRouter;
