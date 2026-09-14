import express from 'express';
import gameController from '../controllers/game.controller.js';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';

export const userGameRouter = express.Router();
export const adminGameRouter = express.Router();

// ── User / Mobile Game Routes ──
userGameRouter.get('/', gameController.getCatalog);
userGameRouter.get('/:id', gameController.getGameById);
userGameRouter.post('/:id/play', authenticate, gameController.playRound);

// ── Admin Game Management Routes ──
adminGameRouter.use(authenticate);
adminGameRouter.get('/', requirePermission('view_games'), gameController.adminGetCatalog);
adminGameRouter.put('/:id/config', requirePermission('manage_games'), gameController.adminUpdateConfig);
adminGameRouter.patch('/:id/status', requirePermission('manage_games'), gameController.adminToggleStatus);

export default { userGameRouter, adminGameRouter };
