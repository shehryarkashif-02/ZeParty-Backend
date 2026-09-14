/**
 * ZeParty Fast Seed Script
 * Uses createMany + skipDuplicates instead of individual upserts
 * to avoid Railway proxy latency on hundreds of round trips.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { MODULE_PERMISSIONS, DEFAULT_ROLES } from "../src/constants/permissions.js";
import { BASELINE_POLICY_TEMPLATES, BASELINE_CONFIG_VALUES } from "../src/constants/policyDefaults.js";

const prisma = new PrismaClient({ log: ["warn", "error"] });

async function seed() {
  console.log("Starting ZeParty Fast Seed...");

  // 1. Permissions - batch createMany
  const allPerms = MODULE_PERMISSIONS.flatMap(g =>
    g.permissions.map(p => ({ id: p.id, label: p.label, module: g.module }))
  );
  const permResult = await prisma.permission.createMany({ data: allPerms, skipDuplicates: true });
  console.log(`Permissions: ${permResult.count} created (${allPerms.length} total)`);

  // 2. Roles - batch createMany
  const roleData = DEFAULT_ROLES.map(r => ({
    id: r.id, name: r.name, description: r.description, isSystemRole: r.isSystemRole
  }));
  const roleResult = await prisma.role.createMany({ data: roleData, skipDuplicates: true });
  console.log(`Roles: ${roleResult.count} created (${roleData.length} total)`);

  // 3. RolePermissions - batch createMany
  const rolePerms = DEFAULT_ROLES.flatMap(r =>
    r.permissions.map(permId => ({ roleId: r.id, permissionId: permId }))
  );
  const rpResult = await prisma.rolePermission.createMany({ data: rolePerms, skipDuplicates: true });
  console.log(`RolePermissions: ${rpResult.count} created (${rolePerms.length} total)`);

  // 4. Admin accounts - batch with hashed passwords
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || "admin";
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@zeparty.app";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "admin123";

  const ownerUsername = process.env.OWNER_USERNAME || "owner";
  const ownerEmail = process.env.OWNER_EMAIL || "owner@zeparty.app";
  const ownerPassword = process.env.OWNER_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || "admin123";

  const [adminHash, ownerHash] = await Promise.all([
    bcrypt.hash(superAdminPassword, 10),
    bcrypt.hash(ownerPassword, 10),
  ]);
  const [finHash, hostHash, restHash] = await Promise.all([
    bcrypt.hash("FinanceadminSecret123!", 10),
    bcrypt.hash("HostadminSecret123!", 10),
    bcrypt.hash("RestrictedadminSecret123!", 10),
  ]);

  const adminRows = [
    { id: "dev-admin-main-001", name: "Super Admin", username: superAdminUsername, email: superAdminEmail, passwordHash: adminHash, status: "ACTIVE", isSuperAdmin: true, isOwner: false, roleId: "super_admin" },
    { id: "dev-owner-001", name: "Root Owner", username: ownerUsername, email: ownerEmail, passwordHash: ownerHash, status: "ACTIVE", isSuperAdmin: true, isOwner: true },
    { id: "dev-finance-001", name: "Finance Admin", username: "financeadmin", email: "financeadmin@zeparty.app", passwordHash: finHash, status: "ACTIVE", isSuperAdmin: false, isOwner: false, roleId: "finance_admin" },
    { id: "dev-host-001", name: "Host Admin", username: "hostadmin", email: "hostadmin@zeparty.app", passwordHash: hostHash, status: "ACTIVE", isSuperAdmin: false, isOwner: false, roleId: "host_admin" },
    { id: "dev-restricted-001", name: "Restricted Admin", username: "restrictedadmin", email: "restrictedadmin@zeparty.app", passwordHash: restHash, status: "ACTIVE", isSuperAdmin: false, isOwner: false, roleId: "host_admin" },
  ];
  const adminResult = await prisma.admin.createMany({ data: adminRows, skipDuplicates: true });
  console.log(`Admins: ${adminResult.count} created (${adminRows.length} total)`);

  // Ensure shadow users exist for Super Admin and Owner
  await prisma.user.upsert({
    where: { id: "dev-admin-main-001" },
    update: { email: superAdminEmail },
    create: { id: "dev-admin-main-001", username: `admin_${superAdminUsername}`, email: superAdminEmail, status: "ACTIVE", userType: "USER" },
  }).catch(() => {});
  await prisma.user.upsert({
    where: { id: "dev-owner-001" },
    update: { email: ownerEmail },
    create: { id: "dev-owner-001", username: `admin_${ownerUsername}`, email: ownerEmail, status: "ACTIVE", userType: "USER" },
  }).catch(() => {});

  // 5. AdminModuleAccess
  const financeModules = ["recharge-plans","online-recharge","offline-recharge","withdrawals","transactions","finance","coin-refunds","reseller-corrections","refund-requests","chargebacks","risk"];
  const hostModules = ["hosts","agencies","bd-centers"];
  const restrictedModules = ["hosts","agencies","coin-sellers"];
  const moduleAccessRows = [
    ...financeModules.map(m => ({ adminId: "dev-finance-001", module: m, grantedBy: "dev-owner-001" })),
    ...hostModules.map(m => ({ adminId: "dev-host-001", module: m, grantedBy: "dev-owner-001" })),
    ...restrictedModules.map(m => ({ adminId: "dev-restricted-001", module: m, grantedBy: "dev-owner-001" })),
  ];
  await prisma.adminModuleAccess.deleteMany({ where: { adminId: { in: ["dev-finance-001","dev-host-001","dev-restricted-001"] } } });
  const maResult = await prisma.adminModuleAccess.createMany({ data: moduleAccessRows, skipDuplicates: true });
  console.log(`AdminModuleAccess: ${maResult.count} created`);

  // 6. Policies & PolicyVersions
  for (const [pType, template] of Object.entries(BASELINE_POLICY_TEMPLATES)) {
    const policy = await prisma.policy.upsert({
      where: { policyType: pType },
      update: { description: template.description },
      create: { policyType: pType, version: template.version, description: template.description },
    });
    const existingVersion = await prisma.policyVersion.findFirst({
      where: { policyId: policy.id, version: template.version },
    });
    if (!existingVersion) {
      await prisma.policyVersion.create({
        data: { policyId: policy.id, version: template.version, summary: `Baseline ${pType}`, configJson: template.config, approvedBy: "Root Owner" },
      });
    }
  }
  console.log(`Policies: ${Object.keys(BASELINE_POLICY_TEMPLATES).length} upserted`);


  // 7. PolicyConfiguration - batch
  const configRows = Object.entries(BASELINE_CONFIG_VALUES).map(([k, v]) => ({ key: k, valueJson: v, status: "ACTIVE" }));
  const cfgResult = await prisma.policyConfiguration.createMany({ data: configRows, skipDuplicates: true });
  console.log(`PolicyConfigurations: ${cfgResult.count} created (${configRows.length} total)`);

  // 8. HostLevelConfig
  const liveTiers = BASELINE_POLICY_TEMPLATES.LIVE_HOST.config.tiers;
  const hostCfgRows = liveTiers.map(t => ({
    level: t.level,
    hostType: "LIVE_HOST",
    targetDiamonds: BigInt(t.targetDiamonds),
    basicSalaryUSD: t.basicSalaryUSD,
    dailyHoursRequired: 1.0,
    daysRequiredPerMonth: t.durationDays || 10,
  }));
  const hcResult = await prisma.hostLevelConfig.createMany({ data: hostCfgRows, skipDuplicates: true });
  console.log(`HostLevelConfig: ${hcResult.count} created`);

  // 9. Dev User + BD Center + Agency + CoinSeller
  await prisma.user.upsert({
    where: { phone: "+10000000001" },
    update: {},
    create: { id: "dev-user-001", phone: "+10000000001", username: "dev_platform_user", email: "dev_user@zeparty.app", status: "ACTIVE" },
  });
  await prisma.bDCenter.upsert({
    where: { id: "dev-bdc-001" },
    update: {},
    create: { id: "dev-bdc-001", centerName: "Asia Pacific BD Center", regionCode: "US", managerUserId: "dev-user-001", currentTier: "BRONZE", baseSalaryUSD: 500.0 },
  });
  await prisma.agency.upsert({
    where: { agencyCode: "STAR-01" },
    update: {},
    create: { id: "dev-agency-001", agencyName: "StarMedia Entertainment", agencyCode: "STAR-01", agencyType: "LIVE_AGENCY", ownerUserId: "dev-user-001", bdCenterId: "dev-bdc-001", commissionRate: 20.0, status: "ACTIVE" },
  });
  await prisma.coinSeller.upsert({
    where: { userId: "dev-user-001" },
    update: {},
    create: { id: "dev-seller-001", userId: "dev-user-001", businessName: "Global Pay Solutions", profitMarginPercent: 10.0, creditLimitUSD: 1000.0, sellerStatus: "ACTIVE", resellerBalanceCoins: 0n },
  });
  console.log("Dev entities (User, BDCenter, Agency, CoinSeller): upserted");

  // 10. Gifts - batch
  const gifts = [
    { id: "gift-rose-01", name: "Rose", coinValue: 10n, giftCategory: "POPULAR", iconUrl: "https://cdn.zeparty.app/gifts/rose.png", isAnimated: false, isFullScreen: false },
    { id: "gift-heart-02", name: "Love Heart", coinValue: 50n, giftCategory: "POPULAR", iconUrl: "https://cdn.zeparty.app/gifts/heart.png", isAnimated: false, isFullScreen: false },
    { id: "gift-car-03", name: "Sports Car", coinValue: 500n, giftCategory: "LUXURY", iconUrl: "https://cdn.zeparty.app/gifts/car.png", svgaAssetUrl: "https://cdn.zeparty.app/svga/sports_car.svga", isAnimated: true, isFullScreen: true },
    { id: "gift-jet-04", name: "Private Jet", coinValue: 2000n, giftCategory: "LUXURY", iconUrl: "https://cdn.zeparty.app/gifts/jet.png", svgaAssetUrl: "https://cdn.zeparty.app/svga/private_jet.svga", isAnimated: true, isFullScreen: true },
    { id: "gift-crown-05", name: "Golden Crown", coinValue: 1000n, giftCategory: "VIP", iconUrl: "https://cdn.zeparty.app/gifts/crown.png", svgaAssetUrl: "https://cdn.zeparty.app/svga/golden_crown.svga", isAnimated: true, isFullScreen: false },
    { id: "gift-castle-06", name: "Castle", coinValue: 5000n, giftCategory: "VIP", iconUrl: "https://cdn.zeparty.app/gifts/castle.png", svgaAssetUrl: "https://cdn.zeparty.app/svga/castle.svga", isAnimated: true, isFullScreen: true },
    { id: "gift-firework-07", name: "Firework", coinValue: 300n, giftCategory: "POPULAR", iconUrl: "https://cdn.zeparty.app/gifts/firework.png", svgaAssetUrl: "https://cdn.zeparty.app/svga/firework.svga", isAnimated: true, isFullScreen: false },
    { id: "gift-wand-08", name: "Magic Wand", coinValue: 150n, giftCategory: "AUDIO", iconUrl: "https://cdn.zeparty.app/gifts/wand.png", isAnimated: false, isFullScreen: false },
  ];
  const giftRows = gifts.map(g => ({ ...g, platformCutPercent: 45.0, hostCutPercent: 35.0, agencyCutPercent: 12.0, roomCutPercent: 8.0, isActive: true }));
  const giftResult = await prisma.gift.createMany({ data: giftRows, skipDuplicates: true });
  console.log(`Gifts: ${giftResult.count} created (${giftRows.length} total)`);

  // 11. Assets - batch
  const assets = [
    { id: "ast-car-01", name: "Golden Sports Car", assetType: "VEHICLE", assetSubcategory: "ANIMATED_SVGA", priceCoins: 500000n, validDays: 30, thumbnailUrl: "https://cdn.zeparty.app/assets/cars/car_gold.png", animationFileUrl: "https://cdn.zeparty.app/svga/car_gold.svga", isVipExclusive: true, minVipLevelRequired: 3 },
    { id: "ast-car-02", name: "Luxury SUV", assetType: "VEHICLE", assetSubcategory: "STATIC", priceCoins: 400000n, validDays: 30, thumbnailUrl: "https://cdn.zeparty.app/assets/cars/suv_black.png", isVipExclusive: false, minVipLevelRequired: 0 },
    { id: "ast-frame-01", name: "Golden Warrior Frame", assetType: "FRAME", assetSubcategory: "STATIC", priceCoins: 300000n, validDays: 15, thumbnailUrl: "https://cdn.zeparty.app/assets/frames/warrior.png", isVipExclusive: false, minVipLevelRequired: 0 },
    { id: "ast-frame-02", name: "Spider Hero Frame", assetType: "FRAME", assetSubcategory: "STATIC", priceCoins: 400000n, validDays: 15, thumbnailUrl: "https://cdn.zeparty.app/assets/frames/spider.png", isVipExclusive: false, minVipLevelRequired: 0 },
    { id: "ast-bubble-01", name: "Unicorn Dream Bubble", assetType: "CHAT_BUBBLE", assetSubcategory: "STATIC", priceCoins: 250000n, validDays: 30, thumbnailUrl: "https://cdn.zeparty.app/assets/bubbles/unicorn.png", isVipExclusive: false, minVipLevelRequired: 0 },
  ];
  const assetRows = assets.map(a => ({ ...a, roomAvailability: "BOTH", isActive: true }));
  const assetResult = await prisma.asset.createMany({ data: assetRows, skipDuplicates: true });
  console.log(`Assets: ${assetResult.count} created (${assetRows.length} total)`);

  console.log("\nSEED COMPLETE.");
}

seed()
  .catch(e => { console.error("Seed error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
