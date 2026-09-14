import tokenService from '../services/token.service.js';
import sessionRepository from '../repositories/session.repository.js';
import userRepository from '../repositories/user.repository.js';
import adminRepository from '../repositories/admin.repository.js';
import deviceRepository from '../repositories/device.repository.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing or invalid format',
        error: { code: 'UNAUTHORIZED' },
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing',
        error: { code: 'UNAUTHORIZED' },
      });
    }

    // Verify JWT
    const decoded = tokenService.verifyAccessToken(token);

    // Verify Session State in Database
    const session = await sessionRepository.findById(decoded.sessionId);
    if (!session || session.revokedAt || new Date() > new Date(session.expiresAt)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication session expired or revoked',
        error: { code: 'SESSION_REVOKED' },
      });
    }

    // IP Block Check
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    if (ipAddress && (await deviceRepository.isIpBlocked(ipAddress))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. IP address is blocked.',
        error: { code: 'IP_BLOCKED' },
      });
    }

    // Resolve Identity: User or Admin
    if (decoded.isAdmin || decoded.userType === 'ADMIN') {
      const admin = await adminRepository.findById(decoded.sub);
      if (!admin || admin.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Admin account is inactive or suspended',
          error: { code: 'ACCOUNT_SUSPENDED' },
        });
      }

      req.admin = admin;
      req.auth = {
        userId: admin.id,
        sessionId: session.id,
        userType: 'ADMIN',
        isAdmin: true,
        isOwner: Boolean(admin.isOwner),
        isSuperAdmin: Boolean(admin.isSuperAdmin),
        roleId: admin.roleId,
      };
    } else {
      const user = await userRepository.findById(decoded.sub);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authenticated user account not found',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: `Account is ${user.status.toLowerCase()}`,
          error: { code: user.status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_BANNED' },
        });
      }

      req.user = user;
      req.auth = {
        userId: user.id,
        sessionId: session.id,
        userType: user.userType,
        isAdmin: false,
      };
    }

    req.session = session;
    next();
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        error: { code: err.code || 'UNAUTHORIZED' },
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
      error: { code: 'TOKEN_INVALID' },
    });
  }
}

export default authenticate;
