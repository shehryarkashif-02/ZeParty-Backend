import prisma from '../config/database.js';

export async function findAllProviders({ includeInactive = true, db = prisma } = {}) {
  const where = includeInactive ? {} : { isActive: true };
  return await db.paymentProvider.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

export async function findProviderById(id, { db = prisma } = {}) {
  return await db.paymentProvider.findUnique({
    where: { id },
  });
}

export async function findProviderByName(name, { db = prisma } = {}) {
  return await db.paymentProvider.findUnique({
    where: { name: name.toUpperCase() },
  });
}

export async function createProvider(data, { db = prisma } = {}) {
  return await db.paymentProvider.create({
    data: {
      ...data,
      name: data.name.toUpperCase(),
    },
  });
}

export async function updateProvider(id, data, { db = prisma } = {}) {
  return await db.paymentProvider.update({
    where: { id },
    data,
  });
}

export async function deleteProvider(id, { db = prisma } = {}) {
  return await db.paymentProvider.delete({
    where: { id },
  });
}

export default {
  findAllProviders,
  findProviderById,
  findProviderByName,
  createProvider,
  updateProvider,
  deleteProvider,
};
