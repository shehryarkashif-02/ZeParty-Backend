import rechargeService from '../services/recharge.service.js';

export async function handlePaymentWebhook(req, res, next) {
  try {
    const { provider } = req.params;
    const signature =
      req.headers['stripe-signature'] ||
      req.headers['paypal-transmission-sig'] ||
      req.headers['x-braintree-signature'] ||
      req.headers['x-webhook-signature'] ||
      req.headers['signature'];

    const rawBody = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await rechargeService.processPaymentWebhook({
      provider,
      rawBody,
      signature,
      headers: req.headers,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.code === 'PAYMENT_SIGNATURE_INVALID') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'PAYMENT_SIGNATURE_INVALID',
          message: 'Webhook signature validation failed.',
        },
      });
    }
    next(err);
  }
}

export default {
  handlePaymentWebhook,
};
