import paymentProviderService from '../services/paymentProvider.service.js';
import {
  createPaymentProviderSchema,
  updatePaymentProviderSchema,
  providerIdParamSchema,
} from '../validators/paymentProvider.validator.js';

export async function listProviders(req, res, next) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const providers = await paymentProviderService.listPaymentProviders({ includeInactive });

    return res.status(200).json({
      success: true,
      data: providers,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProviderById(req, res, next) {
  try {
    const { id } = providerIdParamSchema.parse(req.params);
    const provider = await paymentProviderService.getPaymentProviderById(id);

    return res.status(200).json({
      success: true,
      data: provider,
    });
  } catch (err) {
    next(err);
  }
}

export async function createProvider(req, res, next) {
  try {
    const validated = createPaymentProviderSchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const provider = await paymentProviderService.createPaymentProvider(
      validated,
      adminId,
      isOwner,
      ipAddress
    );

    return res.status(201).json({
      success: true,
      message: 'Payment provider configured successfully',
      data: provider,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProvider(req, res, next) {
  try {
    const { id } = providerIdParamSchema.parse(req.params);
    const validated = updatePaymentProviderSchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const provider = await paymentProviderService.updatePaymentProvider(
      id,
      validated,
      adminId,
      isOwner,
      ipAddress
    );

    return res.status(200).json({
      success: true,
      message: 'Payment provider updated successfully',
      data: provider,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  listProviders,
  getProviderById,
  createProvider,
  updateProvider,
};
