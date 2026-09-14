import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import userController from '../controllers/user.controller.js';

export const adminUserRouter = express.Router();
export const userProfileRouter = express.Router();

// Admin User Management Routes (require authenticate + RBAC)
adminUserRouter.use(authenticate);
adminUserRouter.get('/', requirePermission('view_users'), userController.getAdminUsers);
adminUserRouter.get('/:id', requirePermission('view_users'), userController.getAdminUserById);
adminUserRouter.patch('/:id/status', requirePermission('suspend_users'), userController.patchAdminUserStatus);

// User Self & Public Profile Routes
userProfileRouter.get('/me', authenticate, userController.getMe);
userProfileRouter.put('/profile', authenticate, userController.putMyProfile);
userProfileRouter.get('/:id', authenticate, userController.getPublicUserById);

export default {
  adminUserRouter,
  userProfileRouter,
};
