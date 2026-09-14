import prisma from '../config/database.js';

export async function findAll(db = prisma) {
  return await db.policy.findMany({
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
        take: 1, // Include latest version summary
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findById(id, db = prisma) {
  if (!id) return null;
  return await db.policy.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function findByType(policyType, db = prisma) {
  if (!policyType) return null;
  return await db.policy.findUnique({
    where: { policyType: policyType.toUpperCase() },
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function createPolicy(
  { policyType, version = 'v1.0.0', description = null },
  db = prisma
) {
  return await db.policy.create({
    data: {
      policyType: policyType.toUpperCase(),
      version,
      description,
    },
  });
}

export async function updateActiveVersion(id, version, db = prisma) {
  return await db.policy.update({
    where: { id },
    data: { version },
  });
}

export async function createVersion(
  {
    policyId,
    version,
    summary,
    configJson,
    approvedBy,
    effectiveDate = new Date(),
  },
  db = prisma
) {
  return await db.policyVersion.create({
    data: {
      policyId,
      version,
      summary,
      configJson,
      approvedBy,
      effectiveDate,
    },
  });
}

export async function findVersionById(id, db = prisma) {
  if (!id) return null;
  return await db.policyVersion.findUnique({
    where: { id },
    include: {
      policy: true,
    },
  });
}

export async function findVersionByPolicyAndTag(policyId, version, db = prisma) {
  return await db.policyVersion.findFirst({
    where: {
      policyId,
      version,
    },
  });
}

export async function findVersionsByPolicyId(
  policyId,
  { page = 1, limit = 20 },
  db = prisma
) {
  const skip = (Math.max(1, page) - 1) * limit;

  return await db.policyVersion.findMany({
    where: { policyId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
}

export async function countVersionsByPolicyId(policyId, db = prisma) {
  return await db.policyVersion.count({
    where: { policyId },
  });
}

export default {
  findAll,
  findById,
  findByType,
  createPolicy,
  updateActiveVersion,
  createVersion,
  findVersionById,
  findVersionByPolicyAndTag,
  findVersionsByPolicyId,
  countVersionsByPolicyId,
};
