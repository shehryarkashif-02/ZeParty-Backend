import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createBDCenterSchema,
  createBDInviteSchema,
  acceptBDInviteSchema,
} from '../src/validators/bdCenter.validator.js';
import {
  createSellerSchema,
  allocateSellerCoinsSchema,
  correctSellerBalanceSchema,
} from '../src/validators/seller.validator.js';
import {
  createBDCenter,
  sendBDInvite,
  validateInviteCode,
  acceptBDInvite,
} from '../src/services/bdCenter.service.js';
import {
  createSeller,
  updateSellerStatus,
  allocateCoinsToSeller,
  correctSellerBalance,
  getEffectiveTransferFee,
} from '../src/services/seller.service.js';

describe('Phase 8 BD Centers & Resellers Specification Suite', () => {
  describe('1. BD Center Validation & Invitation Lifecycle', () => {
    it('validates BD Center creation and defaults to BRONZE tier', () => {
      const input = {
        centerName: 'Europe BD Center',
        regionCode: 'EU',
        managerUserId: 'usr-mgr-001',
      };
      const validated = createBDCenterSchema.parse(input);
      assert.strictEqual(validated.currentTier, 'BRONZE');
      assert.strictEqual(validated.baseSalaryUSD, 500.0);
    });

    it('generates a secure unique invitation code when sending invite', async () => {
      let createdInvite = null;
      const mockDb = {
        bDCenter: {
          findUnique: async () => ({ id: 'bdc-001', regionCode: 'US', centerName: 'US Center' }),
        },
        bDInvite: {
          findFirst: async () => null,
          create: async ({ data }) => {
            createdInvite = { id: 'inv-001', ...data };
            return createdInvite;
          },
        },
        auditLog: { create: async () => ({ id: 'audit-001' }) },
      };

      const invite = await sendBDInvite(
        { bdCenterId: 'bdc-001', targetUserId: 'usr-agent-001' },
        { adminId: 'admin-001', adminName: 'Admin' },
        mockDb
      );

      assert.strictEqual(invite.id, 'inv-001');
      assert.match(invite.invitationCode, /^BDC-US-[A-F0-9]{8}$/);
    });

    it('atomically accepts BD invitation, sets userType = BD_AGENT, and updates invite status', async () => {
      let userTypeUpdated = null;
      let hostBoundBDCenter = null;

      const mockDb = {
        bDInvite: {
          findUnique: async ({ where }) => {
            if (where.invitationCode === 'BDC-US-ABCDEF12') {
              return {
                id: 'inv-001',
                bdCenterId: 'bdc-001',
                targetUserId: 'usr-target-001',
                invitationCode: 'BDC-US-ABCDEF12',
                status: 'PENDING',
              };
            }
            return null;
          },
        },
        $transaction: async (cb) => {
          const tx = {
            bDInvite: {
              update: async ({ data }) => ({ id: 'inv-001', status: data.status, acceptedAt: data.acceptedAt }),
            },
            user: {
              update: async ({ data }) => {
                userTypeUpdated = data.userType;
                return { id: 'usr-target-001', userType: data.userType };
              },
            },
            hostProfile: {
              findUnique: async () => ({ id: 'hst-001', userId: 'usr-target-001' }),
              update: async ({ data }) => {
                hostBoundBDCenter = data.bdCenterId;
                return { id: 'hst-001', bdCenterId: data.bdCenterId };
              },
            },
          };
          return await cb(tx);
        },
        auditLog: { create: async () => ({ id: 'audit-002' }) },
      };

      const accepted = await acceptBDInvite(
        'BDC-US-ABCDEF12',
        'usr-target-001',
        {},
        mockDb
      );

      assert.strictEqual(accepted.status, 'ACCEPTED');
      assert.strictEqual(userTypeUpdated, 'BD_AGENT');
      assert.strictEqual(hostBoundBDCenter, 'bdc-001');
    });

    it('rejects invitation acceptance if target user does not match', async () => {
      const mockDb = {
        bDInvite: {
          findUnique: async () => ({
            id: 'inv-001',
            bdCenterId: 'bdc-001',
            targetUserId: 'usr-actual-target',
            status: 'PENDING',
          }),
        },
      };

      await assert.rejects(
        async () => {
          await acceptBDInvite('BDC-US-ABCDEF12', 'usr-wrong-user', {}, mockDb);
        },
        (err) => err.code === 'INVITE_USER_MISMATCH'
      );
    });
  });

  describe('2. Reseller Coin Allocations & Financial Safeguards', () => {
    it('validates coin seller creation and enforces positive credit limit', () => {
      const input = {
        userId: 'usr-seller-001',
        businessName: 'Apex Coin Distributors',
        profitMarginPercent: 12.5,
        creditLimitUSD: 5000.0,
      };
      const validated = createSellerSchema.parse(input);
      assert.strictEqual(validated.businessName, 'Apex Coin Distributors');
      assert.strictEqual(validated.creditLimitUSD, 5000.0);
    });

    it('triggers two-stage maker-checker approval when allocation exceeds 1,000,000 coins ($100 USD)', async () => {
      let approvalCreated = false;

      const mockDb = {
        coinSeller: {
          findUnique: async () => ({
            id: 'seller-001',
            userId: 'usr-seller-001',
            businessName: 'Apex Coin Distributors',
            sellerStatus: 'ACTIVE',
            resellerBalanceCoins: 500000n,
          }),
        },
        wallet: {
          findUnique: async () => ({ id: 'wal-001', userId: 'usr-seller-001', sellerBalanceCoins: 500000n }),
        },
        adminApproval: {
          create: async () => {
            approvalCreated = true;
            return { id: 'appr-999', status: 'PENDING' };
          },
        },
      };

      const result = await allocateCoinsToSeller(
        'seller-001',
        { amountCoins: '2500000', notes: 'Monthly reseller restock' },
        { adminId: 'admin-regular', adminName: 'Admin', isOwner: false },
        mockDb
      );

      assert.strictEqual(result.requiresApproval, true);
      assert.strictEqual(approvalCreated, true);
      assert.strictEqual(result.status, 'PENDING');
    });

    it('allows Root Owner to execute high-value coin allocation immediately without maker-checker stall', async () => {
      let ledgerPosted = false;
      let sellerBalanceUpdated = null;

      const mockDb = {
        coinSeller: {
          findUnique: async () => ({
            id: 'seller-001',
            userId: 'usr-seller-001',
            sellerStatus: 'ACTIVE',
            resellerBalanceCoins: 500000n,
          }),
        },
        wallet: {
          findUnique: async () => ({
            id: 'wal-001',
            userId: 'usr-seller-001',
            coinBalance: 0n,
            diamondBalance: 0n,
            sellerBalanceCoins: 500000n,
            escrowLockedCoins: 0n,
          }),
        },
        $transaction: async (cb) => {
          const tx = {
            wallet: {
              findUnique: async () => ({
                id: 'wal-001',
                userId: 'usr-seller-001',
                coinBalance: 0n,
                diamondBalance: 0n,
                sellerBalanceCoins: 500000n,
                escrowLockedCoins: 0n,
              }),
              update: async () => ({ id: 'wal-001' }),
            },
            walletLedger: {
              create: async () => {
                ledgerPosted = true;
                return { id: 'led-001' };
              },
            },
            coinSeller: {
              update: async ({ data }) => {
                sellerBalanceUpdated = 500000n + data.resellerBalanceCoins.increment;
                return { id: 'seller-001', resellerBalanceCoins: sellerBalanceUpdated };
              },
            },
          };
          return await cb(tx);
        },
        auditLog: { create: async () => ({ id: 'audit-003' }) },
      };

      const result = await allocateCoinsToSeller(
        'seller-001',
        { amountCoins: '5000000' },
        { adminId: 'dev-owner-001', adminName: 'Root Owner', isOwner: true },
        mockDb
      );

      assert.strictEqual(result.requiresApproval, false);
      assert.strictEqual(result.success, true);
      assert.strictEqual(ledgerPosted, true);
      assert.strictEqual(sellerBalanceUpdated, 5500000n);
    });

    it('resolves reseller transfer fee dynamically from policy engine (2.5% baseline)', async () => {
      const mockDb = {
        policyConfiguration: {
          findUnique: async () => null, // Falls back to baseline
        },
      };

      const feePercent = await getEffectiveTransferFee(mockDb);
      assert.strictEqual(feePercent, 2.5);
    });
  });
});
