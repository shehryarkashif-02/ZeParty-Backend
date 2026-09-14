import approvalService from '../services/approval.service.js';
import { reviewApprovalSchema, queryApprovalSchema } from '../validators/approval.validator.js';

export async function getApprovals(req, res, next) {
  try {
    const validated = queryApprovalSchema.parse(req.query);
    const result = await approvalService.getApprovals(validated);

    return res.status(200).json({
      success: true,
      message: 'Approval requests retrieved successfully',
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getApprovalById(req, res, next) {
  try {
    const { id } = req.params;
    const approval = await approvalService.getApprovalById(id);

    return res.status(200).json({
      success: true,
      data: approval,
    });
  } catch (err) {
    next(err);
  }
}

export async function approveRequest(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await approvalService.approveRequest({
      approvalId: id,
      adminId,
      isOwner,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectRequest(req, res, next) {
  try {
    const { id } = req.params;
    const validated = reviewApprovalSchema.parse({ action: 'REJECT', reason: req.body.reason });
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await approvalService.rejectRequest({
      approvalId: id,
      adminId,
      isOwner,
      reason: validated.reason,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Approval request rejected successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getApprovals,
  getApprovalById,
  approveRequest,
  rejectRequest,
};
