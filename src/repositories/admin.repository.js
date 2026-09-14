import prisma from '../config/database.js';

export async function findByUsernameOrEmail(identifier, { includeOwner = true } = {}, db = prisma) {
  if (!identifier) return null;
  const where = {
    OR: [{ username: identifier }, { email: identifier.toLowerCase() }],
  };
  if (!includeOwner) {
    where.isOwner = false;
  }
  return await db.admin.findFirst({
    where,
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      moduleAccess: true,
      ownerGrants: {
        where: { status: 'ACTIVE' },
      },
      permissionOverrides: true,
      teamMemberships: {
        include: {
          team: true,
        },
      },
    },
  });
}

export async function findById(adminId, { includeOwner = true } = {}, db = prisma) {
  if (!adminId) return null;
  const admin = await db.admin.findUnique({
    where: { id: adminId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      moduleAccess: true,
      ownerGrants: {
        where: { status: 'ACTIVE' },
      },
      permissionOverrides: true,
      teamMemberships: {
        include: {
          team: true,
        },
      },
    },
  });

  if (admin && admin.isOwner && !includeOwner) {
    return null;
  }

  return admin;
}

export async function findAll({ includeOwner = false, search = '', roleId = '', status = '' } = {}, db = prisma) {
  const where = {};
  if (!includeOwner) {
    where.isOwner = false;
  }
  if (roleId) {
    where.roleId = roleId;
  }
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  return await db.admin.findMany({
    where,
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      moduleAccess: true,
      ownerGrants: {
        where: { status: 'ACTIVE' },
      },
      permissionOverrides: true,
      teamMemberships: {
        include: {
          team: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createAdmin(data, db = prisma) {
  return await db.admin.create({
    data,
    include: {
      role: true,
      moduleAccess: true,
      ownerGrants: true,
      permissionOverrides: true,
      teamMemberships: {
        include: {
          team: true,
        },
      },
    },
  });
}

export async function updateAdmin(adminId, data, db = prisma) {
  return await db.admin.update({
    where: { id: adminId },
    data,
    include: {
      role: true,
      moduleAccess: true,
      ownerGrants: true,
      permissionOverrides: true,
      teamMemberships: {
        include: {
          team: true,
        },
      },
    },
  });
}

export async function deleteAdmin(adminId, db = prisma) {
  return await db.admin.delete({
    where: { id: adminId },
  });
}

export default {
  findByUsernameOrEmail,
  findById,
  findAll,
  createAdmin,
  updateAdmin,
  deleteAdmin,
};
