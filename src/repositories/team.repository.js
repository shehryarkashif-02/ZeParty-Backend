import prisma from '../config/database.js';

export async function findAllTeams(db = prisma) {
  return await db.team.findMany({
    include: {
      members: {
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              status: true,
              isOwner: true,
              isSuperAdmin: true,
              roleId: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findTeamById(id, db = prisma) {
  return await db.team.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              status: true,
              isOwner: true,
              isSuperAdmin: true,
              roleId: true,
            },
          },
        },
      },
    },
  });
}

export async function createTeam(data, db = prisma) {
  return await db.team.create({
    data,
    include: {
      members: true,
    },
  });
}

export async function updateTeam(id, data, db = prisma) {
  return await db.team.update({
    where: { id },
    data,
    include: {
      members: true,
    },
  });
}

export async function deleteTeam(id, db = prisma) {
  return await db.team.delete({
    where: { id },
  });
}

export async function addTeamMember({ teamId, adminId, roleInTeam }, db = prisma) {
  return await db.teamMember.upsert({
    where: {
      teamId_adminId: { teamId, adminId },
    },
    update: { roleInTeam },
    create: { teamId, adminId, roleInTeam },
  });
}

export async function removeTeamMember({ teamId, adminId }, db = prisma) {
  return await db.teamMember.delete({
    where: {
      teamId_adminId: { teamId, adminId },
    },
  });
}

export default {
  findAllTeams,
  findTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
};
