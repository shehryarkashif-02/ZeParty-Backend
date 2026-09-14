import bannerService from '../services/banner.service.js';
import {
  createBannerSchema,
  updateBannerSchema,
  queryAdminBannersSchema,
  bannerIdParamSchema,
} from '../validators/banner.validator.js';

export async function getAdminBanners(req, res, next) {
  try {
    const validatedQuery = queryAdminBannersSchema.parse(req.query);
    const result = await bannerService.listBannersForAdmin(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Banners retrieved successfully',
      data: result.banners,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminBannerById(req, res, next) {
  try {
    const { id } = bannerIdParamSchema.parse(req.params);
    const banner = await bannerService.getBannerById(id);

    return res.status(200).json({
      success: true,
      message: 'Banner retrieved successfully',
      data: banner,
    });
  } catch (err) {
    next(err);
  }
}

export async function postAdminBanner(req, res, next) {
  try {
    const validatedData = createBannerSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const banner = await bannerService.createBanner(validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner,
    });
  } catch (err) {
    next(err);
  }
}

export async function putAdminBanner(req, res, next) {
  try {
    const { id } = bannerIdParamSchema.parse(req.params);
    const validatedData = updateBannerSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const banner = await bannerService.updateBanner(id, validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: banner,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminBanner(req, res, next) {
  try {
    const { id } = bannerIdParamSchema.parse(req.params);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    await bannerService.deleteBanner(id, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function getActiveBanners(req, res, next) {
  try {
    const banners = await bannerService.getActiveBanners();

    return res.status(200).json({
      success: true,
      message: 'Active banners retrieved successfully',
      data: banners,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getAdminBanners,
  getAdminBannerById,
  postAdminBanner,
  putAdminBanner,
  deleteAdminBanner,
  getActiveBanners,
};
