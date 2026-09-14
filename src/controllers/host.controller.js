import hostRepository from '../repositories/host.repository.js';
import hostService from '../services/host.service.js';
import {
  applyHostSchema,
  reviewHostApplicationSchema,
  updateHostStatusSchema,
  queryHostsSchema,
} from '../validators/host.validator.js';

export async function applyHost(req, res, next) {
  try {
    const validatedData = applyHostSchema.parse(req.body);
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const application = await hostService.applyForHost({
      userId,
      ...validatedData,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Host verification application submitted successfully',
      data: application,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyHostProfile(req, res, next) {
  try {
    const userId = req.auth.userId;
    const host = await hostService.getHostProfileByUserId(userId);

    return res.status(200).json({
      success: true,
      message: 'Host profile retrieved successfully',
      data: host,
    });
  } catch (err) {
    next(err);
  }
}

export async function getHosts(req, res, next) {
  try {
    const validatedQuery = queryHostsSchema.parse(req.query);
    const result = await hostRepository.findHostProfiles(validatedQuery);

    const serializedHosts = result.hosts.map((h) => ({
      ...h,
      totalDiamondsEarnedMonth: h.totalDiamondsEarnedMonth ? h.totalDiamondsEarnedMonth.toString() : '0',
    }));

    return res.status(200).json({
      success: true,
      message: 'Hosts list retrieved successfully',
      data: serializedHosts,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getHostById(req, res, next) {
  try {
    const { id } = req.params;
    const host = await hostService.getHostDetails(id);

    return res.status(200).json({
      success: true,
      message: 'Host details retrieved successfully',
      data: host,
    });
  } catch (err) {
    next(err);
  }
}

export async function getHostApplications(req, res, next) {
  try {
    const { page, limit, status, hostType } = req.query;
    const result = await hostRepository.findApplications({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      hostType,
    });

    return res.status(200).json({
      success: true,
      message: 'Host applications retrieved successfully',
      data: result.applications,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function reviewHostApplication(req, res, next) {
  try {
    const { id } = req.params;
    const validatedData = reviewHostApplicationSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await hostService.reviewHostApplication(id, {
      ...validatedData,
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: `Host application ${validatedData.status.toLowerCase()} successfully`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateHostStatus(req, res, next) {
  try {
    const { id } = req.params;
    const validatedData = updateHostStatusSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const host = await hostService.updateHostProfileStatus(id, {
      ...validatedData,
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Host status updated successfully',
      data: {
        ...host,
        totalDiamondsEarnedMonth: host.totalDiamondsEarnedMonth ? host.totalDiamondsEarnedMonth.toString() : '0',
      },
    });
  } catch (err) {
    next(err);
  }
}

export default {
  applyHost,
  getMyHostProfile,
  getHosts,
  getHostById,
  getHostApplications,
  reviewHostApplication,
  updateHostStatus,
};
