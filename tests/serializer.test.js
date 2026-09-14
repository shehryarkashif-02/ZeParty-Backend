import { describe, it } from 'node:test';
import assert from 'node:assert';
import { serializeData } from '../src/utils/serializer.util.js';

describe('Phase 1 Global BigInt & Decimal Serialization Suite', () => {
  it('converts BigInt primitive to string', () => {
    const input = 4500000000000000n;
    const output = serializeData(input);
    assert.strictEqual(output, '4500000000000000');
    assert.strictEqual(typeof output, 'string');
  });

  it('converts Prisma/Decimal-like objects to string', () => {
    const mockDecimal = {
      isDecimal: true,
      toString: () => '100.50',
      toFixed: (n) => '100.50',
      toNumber: () => 100.5,
    };
    const output = serializeData(mockDecimal);
    assert.strictEqual(output, '100.50');
    assert.strictEqual(typeof output, 'string');
  });

  it('safely serializes nested objects with mixed BigInt, Decimal, and primitives', () => {
    const payload = {
      id: 'usr_123',
      wallet: {
        coinBalance: 50000n,
        diamondBalance: 1200n,
        totalUsd: {
          isDecimal: true,
          toString: () => '250.00',
        },
      },
      metadata: {
        tags: ['vip', 'verified'],
        counts: [10n, 20n, 30n],
      },
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const output = serializeData(payload);

    assert.strictEqual(output.id, 'usr_123');
    assert.strictEqual(output.wallet.coinBalance, '50000');
    assert.strictEqual(output.wallet.diamondBalance, '1200');
    assert.strictEqual(output.wallet.totalUsd, '250.00');
    assert.deepStrictEqual(output.metadata.counts, ['10', '20', '30']);
    assert.strictEqual(output.isActive, true);
    assert.strictEqual(output.createdAt instanceof Date, true);

    // Ensure it can be JSON.stringify'd without throwing
    const jsonString = JSON.stringify(output);
    assert.ok(jsonString.includes('"coinBalance":"50000"'));
  });

  it('handles Arrays, Sets, and Maps containing BigInt', () => {
    const testSet = new Set([100n, 200n]);
    const testMap = new Map([
      ['key1', 500n],
      ['key2', 'standard'],
    ]);

    const serializedSet = serializeData(testSet);
    const serializedMap = serializeData(testMap);

    assert.deepStrictEqual(serializedSet, ['100', '200']);
    assert.deepStrictEqual(serializedMap, { key1: '500', key2: 'standard' });
  });

  it('safely handles circular references without crashing', () => {
    const objA = { name: 'A' };
    const objB = { name: 'B', a: objA };
    objA.b = objB;

    const output = serializeData(objA);
    assert.strictEqual(output.name, 'A');
    assert.strictEqual(output.b.name, 'B');
    assert.strictEqual(output.b.a, '[Circular]');
  });

  it('preserves null and undefined values as is', () => {
    assert.strictEqual(serializeData(null), null);
    assert.strictEqual(serializeData(undefined), undefined);
  });
});
