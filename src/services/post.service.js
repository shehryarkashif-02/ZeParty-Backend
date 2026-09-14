import socialService from './social.service.js';

export const createPost = socialService.createPost;
export const getFeed = socialService.getFeed;
export const getPostById = socialService.getPostById;
export const deletePost = socialService.deletePost;
export const likePost = socialService.likePost;
export const unlikePost = socialService.unlikePost;
export const createComment = socialService.createComment;
export const getPostComments = socialService.getPostComments;
export const deleteComment = socialService.deleteComment;

export default {
  createPost,
  getFeed,
  getPostById,
  deletePost,
  likePost,
  unlikePost,
  createComment,
  getPostComments,
  deleteComment,
};
