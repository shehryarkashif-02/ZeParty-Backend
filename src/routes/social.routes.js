import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import socialController from '../controllers/social.controller.js';

export const socialRouter = express.Router();

// ============================================================
// SOCIAL PROFILE, PRIVACY, FOLLOWS & BLOCKS
// ============================================================

// Social Profile (Optionally authenticated for isFollowing / isBlocked status)
socialRouter.get('/users/:id/social-profile', authenticate, socialController.getSocialProfile);

// Privacy Settings
socialRouter.put('/users/me/privacy', authenticate, socialController.putPrivacySettings);

// Follow / Unfollow
socialRouter.post('/users/:id/follow', authenticate, socialController.postFollow);
socialRouter.delete('/users/:id/follow', authenticate, socialController.deleteFollow);
socialRouter.get('/users/:id/followers', authenticate, socialController.getFollowers);
socialRouter.get('/users/:id/following', authenticate, socialController.getFollowing);

// Blocks
socialRouter.post('/users/:id/block', authenticate, socialController.postBlock);
socialRouter.delete('/users/:id/block', authenticate, socialController.deleteBlock);

export default socialRouter;
