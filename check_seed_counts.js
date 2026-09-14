import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const perms = await prisma.permission.count();
  const roles = await prisma.role.count();
  const admins = await prisma.admin.count();
  const gifts = await prisma.gift.count();
  const assets = await prisma.asset.count();
  const policies = await prisma.policy.count();
  const configs = await prisma.policyConfiguration.count();
  const hostCfg = await prisma.hostLevelConfig.count();
  console.log(JSON.stringify({ perms, roles, admins, gifts, assets, policies, configs, hostCfg }, null, 2));
} catch(e) { console.error(e.message); } finally { await prisma.$disconnect(); }
