import agencyRepository from '../repositories/agency.repository.js';
import agencyService from '../services/agency.service.js';
import hostRepository from '../repositories/host.repository.js';
import {
  createAgencySchema,
  updateAgencySchema,
  transferHostSchema,
  queryAgenciesSchema,
} from '../validators/agency.validator.js';

export async function getPublicAgencies(req, res, next) {
  try {
    const { search, page, limit } = req.query;
    const result = await agencyRepository.findAgencies({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search: search || '',
      status: 'ACTIVE',
    });

    return res.status(200).json({
      success: true,
      message: 'Active agencies retrieved successfully',
      data: result.agencies,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function joinAgency(req, res, next) {
  try {
    const { agencyCode } = req.body;
    const userId = req.auth.userId;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    if (!agencyCode) {
      return res.status(400).json({
        success: false,
        message: 'Agency code is required',
        error: { code: 'MISSING_AGENCY_CODE' },
      });
    }

    const agency = await agencyRepository.findAgencyByCode(agencyCode);
    if (!agency || agency.status !== 'ACTIVE') {
      return res.status(404).json({
        success: false,
        message: 'Active agency with this code not found',
        error: { code: 'AGENCY_NOT_FOUND' },
      });
    }

    const host = await hostRepository.findHostProfileByUserId(userId);
    if (!host) {
      return res.status(400).json({
        success: false,
        message: 'User does not have an active host profile. Please apply for host status first.',
        error: { code: 'NOT_A_HOST' },
      });
    }

    const member = await agencyService.bindHostToAgency(
      { agencyId: agency.id, hostProfileId: host.id },
      { adminId: userId, adminName: 'Host Self-Join', ipAddress }
    );

    return res.status(200).json({
      success: true,
      message: 'Joined agency successfully',
      data: member,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAgencies(req, res, next) {
  try {
    const validatedQuery = queryAgenciesSchema.parse(req.query);
    const result = await agencyRepository.findAgencies(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Agencies list retrieved successfully',
      data: result.agencies,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function createAgency(req, res, next) {
  try {
    const validatedData = createAgencySchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const agency = await agencyService.createAgency(validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Agency created successfully',
      data: agency,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAgencyById(req, res, next) {
  try {
    const { id } = req.params;
    const agency = await agencyService.getAgencyDetails(id);

    return res.status(200).json({
      success: true,
      message: 'Agency details retrieved successfully',
      data: agency,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAgency(req, res, next) {
  try {
    const { id } = req.params;
    const validatedData = updateAgencySchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updated = await agencyService.updateAgency(id, validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Agency updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function transferHostAgency(req, res, next) {
  try {
    const validatedData = transferHostSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const member = await agencyService.transferHostBetweenAgencies(validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Host transferred to new agency successfully',
      data: member,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAgencyMembers(req, res, next) {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;

    const result = await agencyRepository.findAgencyMembers(id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return res.status(200).json({
      success: true,
      message: 'Agency members list retrieved successfully',
      data: result.members,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getPublicAgencies,
  joinAgency,
  getAgencies,
  createAgency,
  getAgencyById,
  updateAgency,
  transferHostAgency,
  getAgencyMembers,
};
