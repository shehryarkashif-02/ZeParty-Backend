import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import requirePermission from '../middlewares/requirePermission.js';
import postController from '../controllers/post.controller.js';
import adminSocialController from '../controllers/adminSocial.controller.js';

export const userPostRouter = express.Router();
export const feedRouter = express.Router();
export const adminPostRouter = express.Router();

// ============================================================
// CONSUMER POST ROUTES
// ============================================================

userPostRouter.post('/', authenticate, postController.postCreatePost);
userPostRouter.get('/:id', postController.getPostById);
userPostRouter.delete('/:id', authenticate, postController.deletePost);

// Likes
userPostRouter.post('/:id/like', authenticate, postController.postLike);
userPostRouter.delete('/:id/like', authenticate, postController.deleteLike);

// Comments
userPostRouter.post('/:id/comments', authenticate, postController.postCreateComment);
userPostRouter.get('/:id/comments', postController.getComments);
userPostRouter.delete('/comments/:id', authenticate, postController.deleteComment);

// Reporting
userPostRouter.post('/:id/report', authenticate, postController.postReport);

// ============================================================
// FEED ROUTES
// ============================================================

feedRouter.get('/', postController.getFeed);

// ============================================================
// ADMIN POST & MODERATION ROUTES
// ============================================================

adminPostRouter.use(authenticate);
adminPostRouter.get('/', requirePermission('view_users'), adminSocialController.getAdminPosts);
adminPostRouter.delete('/:id', requirePermission('delete_user_posts'), adminSocialController.adminDeletePost);
adminPostRouter.delete('/comments/:id', requirePermission('delete_user_posts'), adminSocialController.adminDeleteComment);

export default {
  userPostRouter,
  feedRouter,
  adminPostRouter,
};
