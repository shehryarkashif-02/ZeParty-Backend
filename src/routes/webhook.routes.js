import express from 'express';
import webhookController from '../controllers/webhook.controller.js';

const router = express.Router();

// Public webhook route (verified cryptographically via provider signature)
router.post('/payments/:provider', webhookController.handlePaymentWebhook);

export default router;
