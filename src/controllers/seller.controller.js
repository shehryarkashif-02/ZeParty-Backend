import sellerRepository from '../repositories/seller.repository.js';
import sellerService from '../services/seller.service.js';
import {
  createSellerSchema,
  updateSellerStatusSchema,
  allocateSellerCoinsSchema,
  correctSellerBalanceSchema,
  querySellersSchema,
} from '../validators/seller.validator.js';

export async function getPublicSellers(req, res, next) {
  try {
    const { page, limit, search } = req.query;
    const result = await sellerRepository.findSellers({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search: search || '',
      sellerStatus: 'ACTIVE',
    });

    const serializedSellers = result.sellers.map((s) => ({
      id: s.id,
      businessName: s.businessName,
      profitMarginPercent: s.profitMarginPercent,
      sellerStatus: s.sellerStatus,
      user: {
        id: s.user?.id,
        username: s.user?.username,
        profile: s.user?.profile,
      },
    }));

    return res.status(200).json({
      success: true,
      message: 'Active coin sellers retrieved successfully',
      data: serializedSellers,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getSellers(req, res, next) {
  try {
    const validatedQuery = querySellersSchema.parse(req.query);
    const result = await sellerRepository.findSellers(validatedQuery);

    const serializedSellers = result.sellers.map((s) => ({
      ...s,
      resellerBalanceCoins: s.resellerBalanceCoins ? s.resellerBalanceCoins.toString() : '0',
      creditLimitUSD: s.creditLimitUSD ? s.creditLimitUSD.toString() : '0.00',
      user: s.user
        ? {
            ...s.user,
            wallet: s.user.wallet
              ? {
                  sellerBalanceCoins: s.user.wallet.sellerBalanceCoins
                    ? s.user.wallet.sellerBalanceCoins.toString()
                    : '0',
                  coinBalance: s.user.wallet.coinBalance ? s.user.wallet.coinBalance.toString() : '0',
                }
              : null,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      message: 'Coin sellers retrieved successfully',
      data: serializedSellers,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function createSeller(req, res, next) {
  try {
    const validatedData = createSellerSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const seller = await sellerService.createSeller(validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Coin seller created successfully',
      data: {
        ...seller,
        resellerBalanceCoins: seller.resellerBalanceCoins ? seller.resellerBalanceCoins.toString() : '0',
        creditLimitUSD: seller.creditLimitUSD ? seller.creditLimitUSD.toString() : '0.00',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getSellerById(req, res, next) {
  try {
    const { id } = req.params;
    const seller = await sellerRepository.findSellerById(id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Coin seller not found',
        error: { code: 'SELLER_NOT_FOUND' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Coin seller details retrieved successfully',
      data: {
        ...seller,
        resellerBalanceCoins: seller.resellerBalanceCoins ? seller.resellerBalanceCoins.toString() : '0',
        creditLimitUSD: seller.creditLimitUSD ? seller.creditLimitUSD.toString() : '0.00',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateSellerStatus(req, res, next) {
  try {
    const { id } = req.params;
    const validatedData = updateSellerStatusSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updated = await sellerService.updateSellerStatus(id, validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Coin seller status updated successfully',
      data: {
        ...updated,
        resellerBalanceCoins: updated.resellerBalanceCoins ? updated.resellerBalanceCoins.toString() : '0',
        creditLimitUSD: updated.creditLimitUSD ? updated.creditLimitUSD.toString() : '0.00',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function allocateCoins(req, res, next) {
  try {
    const { id } = req.params;
    const validatedData = allocateSellerCoinsSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const isOwner = Boolean(req.auth?.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await sellerService.allocateCoinsToSeller(id, validatedData, {
      adminId,
      adminName,
      isOwner,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: result.requiresApproval
        ? 'Coin allocation submitted for maker-checker approval'
        : 'Coins allocated to reseller successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function correctBalance(req, res, next) {
  try {
    const { id } = req.params;
    const validatedData = correctSellerBalanceSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const isOwner = Boolean(req.auth?.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await sellerService.correctSellerBalance(id, validatedData, {
      adminId,
      adminName,
      isOwner,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: result.requiresApproval
        ? 'Coin correction submitted for maker-checker approval'
        : 'Reseller balance corrected successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getPublicSellers,
  getSellers,
  createSeller,
  getSellerById,
  updateSellerStatus,
  allocateCoins,
  correctBalance,
};
