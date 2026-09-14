import prisma from '../config/database.js';
import { CANONICAL_GAMES, getCanonicalGame, isValidGameId } from '../constants/game.constants.js';

class GameRepository {
  /**
   * Returns list of canonical games merged with database overrides if available
   */
  async getCatalog({ activeOnly = false } = {}) {
    let dbGames = [];
    try {
      dbGames = await prisma.game.findMany({
        include: {
          configs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
    } catch (err) {
      // If DB is offline or table uninitialized, fallback seamlessly to canonical definitions
      dbGames = [];
    }

    const dbMap = new Map();
    dbGames.forEach((g) => {
      dbMap.set(g.gameKey, g);
    });

    return CANONICAL_GAMES.map((canonical) => {
      const dbRecord = dbMap.get(canonical.gameKey);
      const latestConfig = dbRecord?.configs?.[0];

      return {
        ...canonical,
        dbId: dbRecord?.id || null,
        isActive: dbRecord ? dbRecord.isActive : canonical.isActive,
        minBetCoins: latestConfig ? Number(latestConfig.minBetCoins) : canonical.minBetCoins,
        maxBetCoins: latestConfig ? Number(latestConfig.maxBetCoins) : canonical.maxBetCoins,
        computedRTP: latestConfig ? latestConfig.computedRTP : canonical.computedRTP,
        computedHouseEdge: latestConfig ? latestConfig.computedHouseEdge : canonical.computedHouseEdge,
      };
    }).filter((g) => (activeOnly ? g.isActive : true));
  }

  /**
   * Find canonical game by ID or GameKey
   */
  async findById(gameId) {
    const canonical = getCanonicalGame(gameId);
    if (!canonical) return null;

    try {
      const dbRecord = await prisma.game.findFirst({
        where: { gameKey: canonical.gameKey },
        include: {
          configs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      const latestConfig = dbRecord?.configs?.[0];

      return {
        ...canonical,
        dbId: dbRecord?.id || null,
        isActive: dbRecord ? dbRecord.isActive : canonical.isActive,
        minBetCoins: latestConfig ? Number(latestConfig.minBetCoins) : canonical.minBetCoins,
        maxBetCoins: latestConfig ? Number(latestConfig.maxBetCoins) : canonical.maxBetCoins,
        computedRTP: latestConfig ? latestConfig.computedRTP : canonical.computedRTP,
        computedHouseEdge: latestConfig ? latestConfig.computedHouseEdge : canonical.computedHouseEdge,
      };
    } catch (err) {
      return { ...canonical, dbId: null };
    }
  }

  /**
   * Toggle Game Active State in DB
   */
  async setGameStatus(gameKey, isActive) {
    return prisma.game.upsert({
      where: { gameKey },
      update: { isActive },
      create: {
        gameKey,
        name: getCanonicalGame(gameKey)?.name || gameKey,
        isActive,
      },
    });
  }

  /**
   * Save Game Configuration
   */
  async updateGameConfig(gameKey, { minBetCoins, maxBetCoins, computedRTP, computedHouseEdge, prizeProbabilitiesJson, prizePayoutMultipliersJson }) {
    const game = await prisma.game.upsert({
      where: { gameKey },
      update: {},
      create: {
        gameKey,
        name: getCanonicalGame(gameKey)?.name || gameKey,
        isActive: true,
      },
    });

    return prisma.gameConfig.create({
      data: {
        gameId: game.id,
        minBetCoins: BigInt(minBetCoins || 10),
        maxBetCoins: BigInt(maxBetCoins || 100000),
        computedRTP: computedRTP || 0.95,
        computedHouseEdge: computedHouseEdge || 0.05,
        prizeProbabilitiesJson: prizeProbabilitiesJson || [],
        prizePayoutMultipliersJson: prizePayoutMultipliersJson || [],
      },
    });
  }

  /**
   * Create round record
   */
  async createRound(data, tx = prisma) {
    return tx.gameRound.create({
      data,
    });
  }

  /**
   * Create transaction record
   */
  async createGameTransaction(data, tx = prisma) {
    return tx.gameTransaction.create({
      data,
    });
  }

  /**
   * Find recent transactions
   */
  async getUserRecentGames(userId, limit = 20) {
    return prisma.gameTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        round: true,
      },
    });
  }
}

export default new GameRepository();
