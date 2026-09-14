import gameService from '../services/game.service.js';

class GameController {
  /**
   * GET /v1/games
   */
  async getCatalog(req, res, next) {
    try {
      const { activeOnly } = req.query;
      const games = await gameService.getCatalog({ activeOnly: activeOnly === 'true' });
      return res.status(200).json({
        success: true,
        message: 'Game catalog retrieved successfully',
        data: games,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/games/:id
   */
  async getGameById(req, res, next) {
    try {
      const { id } = req.params;
      const game = await gameService.getGameById(id);
      return res.status(200).json({
        success: true,
        data: game,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /v1/games/:id/play
   */
  async playRound(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.auth?.userId || req.user?.id;
      const { betCoins, actionPayload } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to play games.',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      const result = await gameService.playRound({
        userId,
        gameId: id,
        betCoins,
        actionPayload: actionPayload || {},
        idempotencyKey,
      });

      return res.status(200).json({
        success: true,
        message: 'Round settled successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: GET /v1/admin/games
   */
  async adminGetCatalog(req, res, next) {
    try {
      const games = await gameService.getCatalog({ activeOnly: false });
      return res.status(200).json({
        success: true,
        data: games,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: PUT /v1/admin/games/:id/config
   */
  async adminUpdateConfig(req, res, next) {
    try {
      const { id } = req.params;
      const configData = req.body;
      const adminUser = req.auth || {};

      const result = await gameService.adminUpdateGameConfig(id, configData, adminUser);
      return res.status(200).json({
        success: true,
        message: 'Game configuration updated successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: PATCH /v1/admin/games/:id/status
   */
  async adminToggleStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const adminUser = req.auth || {};

      const result = await gameService.adminToggleGameStatus(id, Boolean(isActive), adminUser);
      return res.status(200).json({
        success: true,
        message: `Game status changed to ${isActive ? 'active' : 'inactive'}`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new GameController();
