import authService from '../services/auth.service.js';
import { calculateEffectivePermissions } from '../services/effectivePermissions.service.js';
import {
  requestOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  adminLoginSchema,
} from '../validators/auth.validator.js';

export async function requestOtp(req, res, next) {
  try {
    const validated = requestOtpSchema.parse(req.body);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const result = await authService.requestOtp({
      phone: validated.phone,
      purpose: validated.purpose,
      ipAddress,
      logger: req.log,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        expiresInSeconds: result.expiresInSeconds,
        ...(result.devOtp ? { devOtp: result.devOtp } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const validated = verifyOtpSchema.parse(req.body);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    const result = await authService.verifyOtpAndAuthenticate({
      phone: validated.phone,
      code: validated.code,
      purpose: validated.purpose,
      device: validated.device,
      ipAddress,
      userAgent,
      logger: req.log,
    });

    return res.status(200).json({
      success: true,
      message: result.isNewUser ? 'User registered and authenticated successfully' : 'Authentication successful',
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
        isNewUser: result.isNewUser,
        user: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const validated = refreshTokenSchema.parse(req.body);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    const result = await authService.refreshToken({
      refreshToken: validated.refreshToken,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const sessionId = req.auth?.sessionId;
    const result = await authService.logout({ sessionId });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    if (req.auth?.isAdmin) {
      const effective = await calculateEffectivePermissions(req.admin.id);
      return res.status(200).json({
        success: true,
        message: 'Current admin details retrieved',
        data: {
          admin: {
            id: req.admin.id,
            name: req.admin.name,
            username: req.admin.username,
            email: req.admin.email,
            status: req.admin.status,
            isSuperAdmin: Boolean(req.admin.isSuperAdmin),
            isOwner: Boolean(req.admin.isOwner),
            role: req.admin.roleId,
            effectivePermissions: effective.permissions,
            effectiveModules: effective.modules,
          },
        },
      });
    }

    const user = await authService.getCurrentUser({ userId: req.auth.userId });

    return res.status(200).json({
      success: true,
      message: 'Current user details retrieved',
      data: {
        user,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function adminLogin(req, res, next) {
  try {
    const validated = adminLoginSchema.parse(req.body);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    const result = await authService.adminLogin({
      usernameOrEmail: validated.usernameOrEmail,
      password: validated.password,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: 'Admin authentication successful',
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
        admin: result.admin,
      },
    });
  } catch (err) {
    next(err);
  }
}

export default {
  requestOtp,
  verifyOtp,
  refresh,
  logout,
  me,
  adminLogin,
};
