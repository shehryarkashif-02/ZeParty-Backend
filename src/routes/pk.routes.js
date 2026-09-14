import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import pkController from '../controllers/pk.controller.js';

export const userPKRouter = express.Router();
userPKRouter.use(authenticate);

userPKRouter.post('/start', pkController.startPK);
userPKRouter.get('/room/:roomId', pkController.getRoomPKStatus);
userPKRouter.post('/:id/end', pkController.endPK);

export const adminPKRouter = express.Router();
adminPKRouter.use(authenticate);

adminPKRouter.get('/', requirePermission('view_pk_events'), pkController.listAdminPKEvents);
adminPKRouter.post('/start', requirePermission('manage_pk_events'), pkController.startPK);
adminPKRouter.post('/:id/end', requirePermission('manage_pk_events'), pkController.endPK);

export default {
  userPKRouter,
  adminPKRouter,
};
