import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import mediaController from '../controllers/media.controller.js';

const router = express.Router();

router.use(authenticate);

// Media upload and management endpoints
router.post('/upload', mediaController.uploadMedia);
router.get('/presigned-url', mediaController.getPresignedUploadUrl);
router.delete('/:key(*)', mediaController.deleteMedia);

export default router;
