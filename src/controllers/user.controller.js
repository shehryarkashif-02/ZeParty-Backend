import userService from '../services/user.service.js';
import {
  queryUsersSchema,
  updateUserStatusSchema,
  updateUserProfileSchema,
  userIdParamSchema,
} from '../validators/user.validator.js';

export async function getAdminUsers(req, res, next) {
  try {
    const validatedQuery = queryUsersSchema.parse(req.query);
    const result = await userService.listUsersForAdmin(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: result.users,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminUserById(req, res, next) {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const user = await userService.getUserDetailsForAdmin(id);

    return res.status(200).json({
      success: true,
      message: 'User details retrieved successfully',
      data: user,
    });
  } catch (err) {
    next(err);
  }
}

export async function patchAdminUserStatus(req, res, next) {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const validatedData = updateUserStatusSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updatedUser = await userService.updateUserStatusByAdmin(id, {
      ...validatedData,
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: `User status updated to ${validatedData.status} successfully`,
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const userId = req.auth.userId;
    const user = await userService.getSelfProfile(userId);

    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: user,
    });
  } catch (err) {
    next(err);
  }
}

export async function putMyProfile(req, res, next) {
  try {
    const userId = req.auth.userId;
    const validatedData = updateUserProfileSchema.parse(req.body);
    const updatedUser = await userService.updateSelfProfile(userId, validatedData);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPublicUserById(req, res, next) {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const publicUser = await userService.getPublicProfile(id);

    return res.status(200).json({
      success: true,
      message: 'Public profile retrieved successfully',
      data: publicUser,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getAdminUsers,
  getAdminUserById,
  patchAdminUserStatus,
  getMe,
  putMyProfile,
  getPublicUserById,
};
