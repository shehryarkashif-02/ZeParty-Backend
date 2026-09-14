import policyService from '../services/policy.service.js';
import autoRestoreService from '../services/autoRestore.service.js';
import policyRepository from '../repositories/policy.repository.js';
import {
  createPolicySchema,
  createVersionSchema,
  rollbackPolicySchema,
  updateConfigSchema,
  toggleConfigSchema,
  queryPolicySchema,
} from '../validators/policy.validator.js';

// --- Policies & Versions ---

export async function getPolicies(req, res, next) {
  try {
    const policies = await policyService.getPolicies();
    return res.status(200).json({
      success: true,
      data: policies,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPolicyById(req, res, next) {
  try {
    const { id } = req.params;
    const policy = await policyService.getPolicyById(id);
    return res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (err) {
    next(err);
  }
}

export async function getEffectivePolicy(req, res, next) {
  try {
    const { policyType } = req.params;
    const effective = await policyService.getEffectivePolicy(policyType);
    if (!effective) {
      return res.status(404).json({
        success: false,
        message: `No active or default policy found for "${policyType}"`,
      });
    }
    return res.status(200).json({
      success: true,
      data: effective,
    });
  } catch (err) {
    next(err);
  }
}

export async function createPolicy(req, res, next) {
  try {
    const validated = createPolicySchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const policy = await policyService.createPolicy({
      policyType: validated.policyType,
      description: validated.description,
      initialConfig: validated.initialConfig,
      version: validated.version,
      adminId,
      isOwner,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Policy created successfully',
      data: policy,
    });
  } catch (err) {
    next(err);
  }
}

export async function getVersions(req, res, next) {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const versions = await policyRepository.findVersionsByPolicyId(id, { page, limit });
    const total = await policyRepository.countVersionsByPolicyId(id);

    return res.status(200).json({
      success: true,
      data: versions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createVersion(req, res, next) {
  try {
    const { id } = req.params;
    const validated = createVersionSchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const newVersion = await policyService.createVersion({
      policyId: id,
      version: validated.version,
      summary: validated.summary,
      configJson: validated.configJson,
      adminId,
      isOwner,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Policy version drafted successfully',
      data: newVersion,
    });
  } catch (err) {
    next(err);
  }
}

export async function publishVersion(req, res, next) {
  try {
    const { id, versionId } = req.params;
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await policyService.publishVersion({
      policyId: id,
      versionId,
      adminId,
      isOwner,
      ipAddress,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function rollbackPolicy(req, res, next) {
  try {
    const { id } = req.params;
    const validated = rollbackPolicySchema.parse(req.body);
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await policyService.rollbackPolicy({
      policyId: id,
      targetVersion: validated.targetVersion,
      reason: validated.reason,
      adminId,
      isOwner,
      ipAddress,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// --- Dynamic Economy Configurations ---

export async function getConfigurations(req, res, next) {
  try {
    const configs = await policyService.getConfigurations();
    return res.status(200).json({
      success: true,
      data: configs,
    });
  } catch (err) {
    next(err);
  }
}

export async function getEffectiveConfig(req, res, next) {
  try {
    const { key } = req.params;
    const config = await policyService.getEffectiveConfig(key);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: `Configuration key "${key}" not found`,
      });
    }
    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateConfiguration(req, res, next) {
  try {
    const { key } = req.params;
    const validated = updateConfigSchema.parse({ key, valueJson: req.body.valueJson || req.body });
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const config = await policyService.updateConfiguration({
      key: validated.key,
      valueJson: validated.valueJson,
      adminId,
      isOwner,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: `Configuration key "${validated.key}" updated successfully`,
      data: config,
    });
  } catch (err) {
    next(err);
  }
}

export async function disableConfiguration(req, res, next) {
  try {
    const { key } = req.params;
    const validated = toggleConfigSchema.parse(req.body || {});
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updated = await policyService.disableConfiguration({
      key,
      reason: validated.reason,
      adminId,
      isOwner,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: `Configuration key "${key.toUpperCase()}" disabled. 15-day auto-restore scheduled.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function restoreConfiguration(req, res, next) {
  try {
    const { key } = req.params;
    const validated = toggleConfigSchema.parse(req.body || {});
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updated = await policyService.restoreConfiguration({
      key,
      reason: validated.reason,
      adminId,
      isOwner,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: `Configuration key "${key.toUpperCase()}" manually restored to ACTIVE.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// --- Scheduler / Automation Manual Trigger ---

export async function triggerAutoRestoreSweep(req, res, next) {
  try {
    const adminId = req.auth.userId;
    const isOwner = Boolean(req.auth.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const result = await autoRestoreService.manualTrigger({
      adminId,
      isOwner,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: '15-day auto-restore sweep completed',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getPolicies,
  getPolicyById,
  getEffectivePolicy,
  createPolicy,
  getVersions,
  createVersion,
  publishVersion,
  rollbackPolicy,
  getConfigurations,
  getEffectiveConfig,
  updateConfiguration,
  disableConfiguration,
  restoreConfiguration,
  triggerAutoRestoreSweep,
};
