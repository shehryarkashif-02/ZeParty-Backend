import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

import { MODULE_PERMISSIONS, DEFAULT_ROLES } from '../src/constants/permissions.js';

async function seed() {
  console.log('🌱 Starting ZeParty System Configuration Bootstrap...');

  // 1. Seed Canonical Permissions
  for (const moduleGroup of MODULE_PERMISSIONS) {
    for (const perm of moduleGroup.permissions) {
      await prisma.permission.upsert({
        where: { id: perm.id },
        update: {
          label: perm.label,
          module: moduleGroup.module,
        },
        create: {
          id: perm.id,
          label: perm.label,
          module: moduleGroup.module,
        },
      });
    }
  }

  // 2. Seed Default System Roles & Mappings
  for (const roleDef of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { id: roleDef.id },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        isSystemRole: roleDef.isSystemRole,
      },
      create: {
        id: roleDef.id,
        name: roleDef.name,
        description: roleDef.description,
        isSystemRole: roleDef.isSystemRole,
      },
    });

    for (const permId of roleDef.permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permId,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permId,
        },
      });
    }
  }

  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || 'admin';
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@zeparty.app';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123';

  const ownerUsername = process.env.OWNER_USERNAME || 'owner';
  const ownerEmail = process.env.OWNER_EMAIL || 'owner@zeparty.app';
  const ownerPassword = process.env.OWNER_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || 'admin123';

  const adminPasswordHash = await bcrypt.hash(superAdminPassword, 10);
  const ownerPasswordHash = await bcrypt.hash(ownerPassword, 10);

  // 3. Seed Super Admin Identity
  const superAdmin = await prisma.admin.upsert({
    where: { username: superAdminUsername },
    update: {
      email: superAdminEmail,
      passwordHash: adminPasswordHash,
      isSuperAdmin: true,
      isOwner: false,
      roleId: 'super_admin',
    },
    create: {
      id: 'dev-admin-main-001',
      name: 'Super Admin',
      username: superAdminUsername,
      email: superAdminEmail,
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
      isSuperAdmin: true,
      isOwner: false,
      roleId: 'super_admin',
    },
  });

  await prisma.user.upsert({
    where: { id: 'dev-admin-main-001' },
    update: { email: superAdminEmail },
    create: {
      id: 'dev-admin-main-001',
      username: `admin_${superAdminUsername}`,
      email: superAdminEmail,
      status: 'ACTIVE',
      userType: 'USER',
    },
  }).catch(() => {});

  // 4. Seed Root Owner Identity
  await prisma.admin.upsert({
    where: { username: ownerUsername },
    update: {
      email: ownerEmail,
      passwordHash: ownerPasswordHash,
      isSuperAdmin: true,
      isOwner: true,
    },
    create: {
      id: 'dev-owner-001',
      name: 'Root Owner',
      username: ownerUsername,
      email: ownerEmail,
      passwordHash: ownerPasswordHash,
      status: 'ACTIVE',
      isSuperAdmin: true,
      isOwner: true,
    },
  });

  await prisma.user.upsert({
    where: { id: 'dev-owner-001' },
    update: { email: ownerEmail },
    create: {
      id: 'dev-owner-001',
      username: `admin_${ownerUsername}`,
      email: ownerEmail,
      status: 'ACTIVE',
      userType: 'USER',
    },
  }).catch(() => {});

  const financeAdminPasswordHash = await bcrypt.hash('FinanceadminSecret123!', 10);
  const hostAdminPasswordHash = await bcrypt.hash('HostadminSecret123!', 10);

  // 5. Seed Specialized Admin Roles
  const financeAdmin = await prisma.admin.upsert({
    where: { username: 'financeadmin' },
    update: {
      passwordHash: financeAdminPasswordHash,
      roleId: 'finance_admin',
    },
    create: {
      id: 'dev-finance-001',
      name: 'Finance Admin',
      username: 'financeadmin',
      email: 'financeadmin@zeparty.app',
      passwordHash: financeAdminPasswordHash,
      status: 'ACTIVE',
      isSuperAdmin: false,
      isOwner: false,
      roleId: 'finance_admin',
    },
  });

  const financeModules = [
    'recharge-plans', 'online-recharge', 'offline-recharge',
    'withdrawals', 'transactions', 'finance', 'coin-refunds',
    'reseller-corrections', 'refund-requests', 'chargebacks', 'risk'
  ];
  await prisma.adminModuleAccess.deleteMany({ where: { adminId: financeAdmin.id } });
  await prisma.adminModuleAccess.createMany({
    data: financeModules.map(m => ({ adminId: financeAdmin.id, module: m, grantedBy: 'dev-owner-001' }))
  });

  const hostAdmin = await prisma.admin.upsert({
    where: { username: 'hostadmin' },
    update: {
      passwordHash: hostAdminPasswordHash,
      roleId: 'host_admin',
    },
    create: {
      id: 'dev-host-001',
      name: 'Host Admin',
      username: 'hostadmin',
      email: 'hostadmin@zeparty.app',
      passwordHash: hostAdminPasswordHash,
      status: 'ACTIVE',
      isSuperAdmin: false,
      isOwner: false,
      roleId: 'host_admin',
    },
  });
  await prisma.adminModuleAccess.deleteMany({ where: { adminId: hostAdmin.id } });
  await prisma.adminModuleAccess.createMany({
    data: ['hosts', 'agencies', 'bd-centers'].map(m => ({ adminId: hostAdmin.id, module: m, grantedBy: 'dev-owner-001' }))
  });

  // 6. Seed Baseline Policies & Configurations
  const { BASELINE_POLICY_TEMPLATES, BASELINE_CONFIG_VALUES } = await import('../src/constants/policyDefaults.js');

  for (const [pType, template] of Object.entries(BASELINE_POLICY_TEMPLATES)) {
    const policy = await prisma.policy.upsert({
      where: { policyType: pType },
      update: {
        description: template.description,
      },
      create: {
        policyType: pType,
        version: template.version,
        description: template.description,
      },
    });

    const existingVersion = await prisma.policyVersion.findFirst({
      where: {
        policyId: policy.id,
        version: template.version,
      },
    });

    if (!existingVersion) {
      await prisma.policyVersion.create({
        data: {
          policyId: policy.id,
          version: template.version,
          summary: `Baseline ${pType} policy release`,
          configJson: template.config,
          approvedBy: 'Root Owner',
        },
      });
    }
  }

  for (const [cfgKey, cfgVal] of Object.entries(BASELINE_CONFIG_VALUES)) {
    await prisma.policyConfiguration.upsert({
      where: { key: cfgKey },
      update: {},
      create: {
        key: cfgKey,
        valueJson: cfgVal,
        status: 'ACTIVE',
      },
    });
  }

  const liveTiers = BASELINE_POLICY_TEMPLATES.LIVE_HOST.config.tiers;
  for (const tier of liveTiers) {
    await prisma.hostLevelConfig.upsert({
      where: {
        level_hostType: {
          level: tier.level,
          hostType: 'LIVE_HOST',
        },
      },
      update: {
        targetDiamonds: BigInt(tier.targetDiamonds),
        basicSalaryUSD: tier.basicSalaryUSD,
        dailyHoursRequired: 1.0,
        daysRequiredPerMonth: tier.durationDays || 10,
      },
      create: {
        level: tier.level,
        hostType: 'LIVE_HOST',
        targetDiamonds: BigInt(tier.targetDiamonds),
        basicSalaryUSD: tier.basicSalaryUSD,
        dailyHoursRequired: 1.0,
        daysRequiredPerMonth: tier.durationDays || 10,
      },
    });
  }

  // 7. Seed Official Recharge Plans
  const plans = [
    { id: 'plan-01', coinAmount: 1000n, priceUSD: 0.99, bonusCoins: 0n, badgeText: 'Starter' },
    { id: 'plan-02', coinAmount: 5500n, priceUSD: 4.99, bonusCoins: 500n, badgeText: 'Popular' },
    { id: 'plan-03', coinAmount: 12000n, priceUSD: 9.99, bonusCoins: 2000n, badgeText: 'Best Value' },
    { id: 'plan-04', coinAmount: 65000n, priceUSD: 49.99, bonusCoins: 15000n, badgeText: 'VIP Choice' },
    { id: 'plan-05', coinAmount: 140000n, priceUSD: 99.99, bonusCoins: 40000n, badgeText: 'High Roller' },
    { id: 'plan-06', coinAmount: 750000n, priceUSD: 499.99, bonusCoins: 250000n, badgeText: 'Whale Exclusive' },
  ];

  for (const p of plans) {
    await prisma.rechargePlan.upsert({
      where: { id: p.id },
      update: { coinAmount: p.coinAmount, priceUSD: p.priceUSD, bonusCoins: p.bonusCoins, badgeText: p.badgeText },
      create: {
        id: p.id,
        coinAmount: p.coinAmount,
        priceUSD: p.priceUSD,
        bonusCoins: p.bonusCoins,
        badgeText: p.badgeText,
        isActive: true,
      },
    });
  }

  // 8. Seed Official Payment Providers
  const providers = [
    { id: 'prov-stripe', name: 'STRIPE', isSandbox: true, isActive: true, feeDescription: '2.9% + $0.30 per successful card charge' },
    { id: 'prov-paypal', name: 'PAYPAL', isSandbox: true, isActive: true, feeDescription: '3.49% + fixed standard transaction fee' },
    { id: 'prov-braintree', name: 'BRAINTREE', isSandbox: true, isActive: true, feeDescription: '2.59% + $0.49 for digital wallet payments' },
    { id: 'prov-easypaisa', name: 'EASYPAISA', isSandbox: true, isActive: true, feeDescription: '1.5% local mobile wallet processing fee' },
    { id: 'prov-jazzcash', name: 'JAZZCASH', isSandbox: true, isActive: true, feeDescription: '1.5% Direct OTC & mobile wallet gateway' },
  ];

  for (const prov of providers) {
    await prisma.paymentProvider.upsert({
      where: { name: prov.name },
      update: { isActive: prov.isActive, feeDescription: prov.feeDescription },
      create: {
        id: prov.id,
        name: prov.name,
        isSandbox: prov.isSandbox,
        isActive: prov.isActive,
        feeDescription: prov.feeDescription,
      },
    });
  }

  // 9. Seed Canonical Virtual Gifts Catalog
  const baselineGifts = [
    { id: 'gift-rose-01', name: 'Rose', coinValue: 10n, giftCategory: 'POPULAR', iconUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop&q=80', isAnimated: false, isFullScreen: false },
    { id: 'gift-heart-02', name: 'Love Heart', coinValue: 50n, giftCategory: 'POPULAR', iconUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100&auto=format&fit=crop&q=80', isAnimated: false, isFullScreen: false },
    { id: 'gift-car-03', name: 'Sports Car', coinValue: 500n, giftCategory: 'LUXURY', iconUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=100&auto=format&fit=crop&q=80', isAnimated: true, isFullScreen: true },
    { id: 'gift-jet-04', name: 'Private Jet', coinValue: 2000n, giftCategory: 'LUXURY', iconUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=100&auto=format&fit=crop&q=80', isAnimated: true, isFullScreen: true },
    { id: 'gift-crown-05', name: 'Golden Crown', coinValue: 1000n, giftCategory: 'VIP', iconUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=100&auto=format&fit=crop&q=80', isAnimated: true, isFullScreen: false },
    { id: 'gift-castle-06', name: 'Castle', coinValue: 5000n, giftCategory: 'VIP', iconUrl: 'https://images.unsplash.com/photo-1585543805890-6051f7829f98?w=100&auto=format&fit=crop&q=80', isAnimated: true, isFullScreen: true },
    { id: 'gift-firework-07', name: 'Firework', coinValue: 300n, giftCategory: 'POPULAR', iconUrl: 'https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?w=100&auto=format&fit=crop&q=80', isAnimated: true, isFullScreen: false },
    { id: 'gift-wand-08', name: 'Magic Wand', coinValue: 150n, giftCategory: 'AUDIO', iconUrl: 'https://images.unsplash.com/photo-1514533450685-4493e01d1fdc?w=100&auto=format&fit=crop&q=80', isAnimated: false, isFullScreen: false },
  ];

  for (const g of baselineGifts) {
    await prisma.gift.upsert({
      where: { id: g.id },
      update: {},
      create: {
        id: g.id,
        name: g.name,
        coinValue: g.coinValue,
        giftCategory: g.giftCategory,
        iconUrl: g.iconUrl,
        isAnimated: g.isAnimated,
        isFullScreen: g.isFullScreen,
        platformCutPercent: 45.0,
        hostCutPercent: 35.0,
        agencyCutPercent: 12.0,
        roomCutPercent: 8.0,
        isActive: true,
      },
    });
  }

  // 10. Seed Canonical Store Assets
  const baselineAssets = [
    { id: 'ast-car-01', name: 'Golden Sports Car', assetType: 'VEHICLE', assetSubcategory: 'ANIMATED_SVGA', priceCoins: 500000n, validDays: 30, thumbnailUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200&auto=format&fit=crop&q=80', isVipExclusive: true, minVipLevelRequired: 3 },
    { id: 'ast-car-02', name: 'Cyberpunk Hovercraft', assetType: 'VEHICLE', assetSubcategory: 'STATIC', priceCoins: 400000n, validDays: 30, thumbnailUrl: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=200&auto=format&fit=crop&q=80', isVipExclusive: false, minVipLevelRequired: 0 },
    { id: 'ast-frame-01', name: 'Golden Warrior Frame', assetType: 'FRAME', assetSubcategory: 'STATIC', priceCoins: 300000n, validDays: 15, thumbnailUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=200&auto=format&fit=crop&q=80', isVipExclusive: false, minVipLevelRequired: 0 },
    { id: 'ast-frame-02', name: 'Neon Cyber Frame', assetType: 'FRAME', assetSubcategory: 'STATIC', priceCoins: 350000n, validDays: 15, thumbnailUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=200&auto=format&fit=crop&q=80', isVipExclusive: false, minVipLevelRequired: 0 },
    { id: 'ast-bubble-01', name: 'Galactic Chat Bubble', assetType: 'CHAT_BUBBLE', assetSubcategory: 'STATIC', priceCoins: 250000n, validDays: 30, thumbnailUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=200&auto=format&fit=crop&q=80', isVipExclusive: false, minVipLevelRequired: 0 },
  ];

  for (const a of baselineAssets) {
    await prisma.asset.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        name: a.name,
        assetType: a.assetType,
        assetSubcategory: a.assetSubcategory,
        priceCoins: a.priceCoins,
        validDays: a.validDays,
        thumbnailUrl: a.thumbnailUrl,
        roomAvailability: 'BOTH',
        isVipExclusive: a.isVipExclusive,
        minVipLevelRequired: a.minVipLevelRequired,
        isActive: true,
      },
    });
  }

  // 11. Seed Canonical Banners & Announcements
  await prisma.banner.upsert({
    where: { id: 'ban-01' },
    update: {},
    create: {
      id: 'ban-01',
      title: 'Grand PK Championship 2026 — $50,000 Prize Pool!',
      imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&auto=format&fit=crop&q=80',
      destinationUrl: '/admin/pk-events',
      position: 1,
      isActive: true,
    },
  });

  await prisma.banner.upsert({
    where: { id: 'ban-02' },
    update: {},
    create: {
      id: 'ban-02',
      title: 'Double Coins Weekend Recharge Bonus',
      imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&auto=format&fit=crop&q=80',
      destinationUrl: '/admin/recharge-plans',
      position: 2,
      isActive: true,
    },
  });

  await prisma.announcement.upsert({
    where: { id: 'ann-01' },
    update: {},
    create: {
      id: 'ann-01',
      title: 'ZeParty Global System Upgrade & Fair Play Policy',
      body: 'Automated audit trail, PostgreSQL financial ledger, and diamond settlement engine active.',
      targetAudience: 'ALL',
      isActive: true,
    },
  });

  console.log('✅ ZeParty System Configuration Bootstrap Successfully Completed!');
  console.log('   - Canonical Permissions & System Roles seeded');
  console.log('   - Owner & Super Admin identities provisioned');
  console.log('   - Baseline Policy Templates & Dynamic Configs loaded');
  console.log('   - Official Recharge Plans & Payment Gateways seeded');
  console.log('   - Canonical Virtual Gifts & Store Catalog initialized');
  console.log('   - Zero fake/mock business data seeded');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
