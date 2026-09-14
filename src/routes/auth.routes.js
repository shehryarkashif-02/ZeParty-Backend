import express from 'express';
import authController from '../controllers/auth.controller.js';
import authenticate from '../middlewares/authenticate.js';

const router = express.Router();

// Public authentication routes
router.post('/request-otp', authController.requestOtp);
router.post('/otp/send', authController.requestOtp); // Blueprint alias

router.post('/verify-otp', authController.verifyOtp);
router.post('/otp/verify', authController.verifyOtp); // Blueprint alias

router.post('/refresh', authController.refresh);
router.post('/admin/login', authController.adminLogin);

// Protected authentication routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
