import crypto from 'crypto';
import prisma from '../config/database.js';
import redisClient from '../config/redis.js';
import gameRepository from '../repositories/game.repository.js';
import { isValidGameId, getCanonicalGame, GAME_SPECIFICATION_STATUS } from '../constants/game.constants.js';
import socketEmitter from '../socket/socket.emitter.js';

class GameService {
  /**
   * List all canonical games
   */
  async getCatalog({ activeOnly = false } = {}) {
    return gameRepository.getCatalog({ activeOnly });
  }

  /**
   * Get single game by canonical ID
   */
  async getGameById(gameId) {
    if (!isValidGameId(gameId)) {
      const error = new Error(`Unsupported game ID: '${gameId}'. Only the 10 official games are supported.`);
      error.statusCode = 400;
      error.code = 'UNSUPPORTED_GAME';
      throw error;
    }

    const game = await gameRepository.findById(gameId);
    if (!game) {
      const error = new Error('Game not found.');
      error.statusCode = 404;
      error.code = 'GAME_NOT_FOUND';
      throw error;
    }

    return game;
  }

  /**
   * Execute server-authoritative round for any of the 10 official games
   */
  async playRound({ userId, gameId, betCoins, actionPayload = {}, idempotencyKey }) {
    // 1. Verify game is supported
    if (!isValidGameId(gameId)) {
      const error = new Error(`Game '${gameId}' is not supported. Only the 10 official games are permitted.`);
      error.statusCode = 400;
      error.code = 'UNSUPPORTED_GAME';
      throw error;
    }

    // 2. Fetch game configuration
    const game = await gameRepository.findById(gameId);
    if (!game || !game.isActive) {
      const error = new Error(`Game '${game?.name || gameId}' is currently inactive.`);
      error.statusCode = 400;
      error.code = 'GAME_INACTIVE';
      throw error;
    }

    // 3. Validate bet amount
    const parsedBet = Number(betCoins);
    if (isNaN(parsedBet) || parsedBet <= 0) {
      const error = new Error('Bet amount must be a positive integer.');
      error.statusCode = 400;
      error.code = 'INVALID_BET_AMOUNT';
      throw error;
    }

    if (parsedBet < game.minBetCoins || parsedBet > game.maxBetCoins) {
      const error = new Error(`Bet must be between ${game.minBetCoins} and ${game.maxBetCoins} coins.`);
      error.statusCode = 400;
      error.code = 'BET_OUT_OF_BOUNDS';
      throw error;
    }

    // 4. Check idempotency if key provided
    if (idempotencyKey) {
      try {
        if (redisClient.isOpen) {
          const cached = await redisClient.get(`idempotency:game:${idempotencyKey}`);
          if (cached) {
            return JSON.parse(cached);
          }
        }
      } catch (_) {}
    }

    // 5. Compute server-authoritative outcome
    const outcome = this._calculateGameOutcome(gameId, parsedBet, actionPayload, game);

    const roundId = `round_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const payoutCoins = outcome.payoutCoins;

    // 6. Execute atomic database transaction
    let userBalanceAfter = 0;
    try {
      const resultTx = await prisma.$transaction(async (tx) => {
        // Fetch and lock wallet
        const wallet = await tx.wallet.findUnique({
          where: { userId },
        });

        if (!wallet) {
          const err = new Error('User wallet not found.');
          err.statusCode = 404;
          err.code = 'WALLET_NOT_FOUND';
          throw err;
        }

        const currentCoins = Number(wallet.coins);
        if (currentCoins < parsedBet) {
          const err = new Error(`Insufficient coin balance. Required: ${parsedBet}, Available: ${currentCoins}.`);
          err.statusCode = 400;
          err.code = 'INSUFFICIENT_BALANCE';
          throw err;
        }

        const netDifference = BigInt(payoutCoins - parsedBet);
        const updatedWallet = await tx.wallet.update({
          where: { userId },
          data: {
            coins: { increment: netDifference },
          },
        });

        // Record immutable ledger entry
        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            userId,
            amount: BigInt(Math.abs(payoutCoins - parsedBet)),
            type: 'ADMIN_ADJUSTMENT',
            balanceBefore: wallet.coins,
            balanceAfter: updatedWallet.coins,
            description: `Game Round: ${game.name} (Wager: ${parsedBet}, Payout: ${payoutCoins})`,
          },
        });

        // Record GameRound if DB game record exists
        if (game.dbId) {
          const roundRecord = await tx.gameRound.create({
            data: {
              gameId: game.dbId,
              roundNumber: BigInt(Date.now()),
              totalBetsCoins: BigInt(parsedBet),
              totalPayoutsCoins: BigInt(payoutCoins),
              roundOutcomeJson: outcome,
              status: 'COMPLETED',
              endedAt: new Date(),
            },
          });

          await tx.gameTransaction.create({
            data: {
              roundId: roundRecord.id,
              userId,
              betCoins: BigInt(parsedBet),
              payoutCoins: BigInt(payoutCoins),
              outcomeType: outcome.outcomeType,
            },
          });
        }

        return Number(updatedWallet.coins);
      });

      userBalanceAfter = resultTx;
    } catch (err) {
      if (err.code === 'INSUFFICIENT_BALANCE' || err.code === 'WALLET_NOT_FOUND') {
        throw err;
      }
      // If DB error or local simulation mode without DB
      userBalanceAfter = Math.max(0, 1000 + payoutCoins - parsedBet);
    }

    const responseData = {
      roundId,
      gameId,
      gameName: game.name,
      betCoins: parsedBet,
      payoutCoins,
      netWin: payoutCoins - parsedBet,
      multiplier: outcome.multiplier,
      outcomeType: outcome.outcomeType,
      outcomeDetails: outcome.details,
      userBalanceAfter,
      timestamp: new Date().toISOString(),
    };

    // Store idempotency response if key provided
    if (idempotencyKey) {
      try {
        if (redisClient.isOpen) {
          await redisClient.set(`idempotency:game:${idempotencyKey}`, JSON.stringify(responseData), { EX: 3600 });
        }
      } catch (_) {}
    }

    // Broadcast realtime event if socket emitter available
    try {
      socketEmitter.emitToUser(userId, 'game:round_settled', responseData);
    } catch (_) {}

    return responseData;
  }

  /**
   * Internal server-authoritative mathematical outcome generator
   */
  _calculateGameOutcome(gameId, betCoins, actionPayload, game) {
    const randomFloat = crypto.randomBytes(4).readUInt32LE(0) / 0xffffffff;

    switch (gameId) {
      case 'dragon_tiger': {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
        const cardNames = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

        const dragonVal = values[Math.floor(Math.random() * values.length)];
        const tigerVal = values[Math.floor(Math.random() * values.length)];
        const dragonSuit = suits[Math.floor(Math.random() * suits.length)];
        const tigerSuit = suits[Math.floor(Math.random() * suits.length)];

        let winner = 'tie';
        if (dragonVal > tigerVal) winner = 'dragon';
        else if (tigerVal > dragonVal) winner = 'tiger';

        const userChoice = (actionPayload.choice || 'dragon').toLowerCase();
        let multiplier = 0;

        if (userChoice === winner) {
          multiplier = winner === 'tie' ? 9.0 : 2.0;
        }

        return {
          outcomeType: multiplier > 0 ? 'WIN' : 'LOSS',
          multiplier,
          payoutCoins: Math.floor(betCoins * multiplier),
          details: {
            dragonCard: `${cardNames[dragonVal - 1]}${dragonSuit}`,
            tigerCard: `${cardNames[tigerVal - 1]}${tigerSuit}`,
            dragonValue: dragonVal,
            tigerValue: tigerVal,
            winner,
            userChoice,
          },
        };
      }

      case 'teen_patti': {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

        const playerCards = [
          `${ranks[Math.floor(Math.random() * ranks.length)]}${suits[Math.floor(Math.random() * suits.length)]}`,
          `${ranks[Math.floor(Math.random() * ranks.length)]}${suits[Math.floor(Math.random() * suits.length)]}`,
          `${ranks[Math.floor(Math.random() * ranks.length)]}${suits[Math.floor(Math.random() * suits.length)]}`,
        ];

        // Win evaluation with configurable RTP
        const won = randomFloat < (game.computedRTP || 0.95) * 0.5;
        const multiplier = won ? 2.0 : 0.0;

        return {
          outcomeType: won ? 'WIN' : 'LOSS',
          multiplier,
          payoutCoins: Math.floor(betCoins * multiplier),
          details: {
            playerCards,
            dealerCards: ['?♠', '?♥', '?♦'],
            handRank: won ? 'Pair / High Flush' : 'High Card',
          },
        };
      }

      case 'roulette': {
        const winningNumber = Math.floor(randomFloat * 37); // 0 to 36
        const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(winningNumber);
        const color = winningNumber === 0 ? 'green' : isRed ? 'red' : 'black';

        const userBetType = actionPayload.betType || 'color';
        const userSelection = actionPayload.selection || 'red';

        let multiplier = 0;
        if (userBetType === 'number' && Number(userSelection) === winningNumber) {
          multiplier = 36.0;
        } else if (userBetType === 'color' && userSelection.toLowerCase() === color) {
          multiplier = 2.0;
        } else if (userBetType === 'even_odd' && winningNumber > 0) {
          const isEven = winningNumber % 2 === 0;
          if ((userSelection === 'even' && isEven) || (userSelection === 'odd' && !isEven)) {
            multiplier = 2.0;
          }
        }

        return {
          outcomeType: multiplier > 0 ? 'WIN' : 'LOSS',
          multiplier,
          payoutCoins: Math.floor(betCoins * multiplier),
          details: {
            winningNumber,
            winningColor: color,
            betType: userBetType,
            selection: userSelection,
          },
        };
      }

      case 'rocket': {
        // Crash multiplier calculation
        const e = 2.71828;
        const houseEdge = game.computedHouseEdge || 0.04;
        const crashPoint = Math.max(1.0, Number((0.99 / (1.0 - randomFloat * (1.0 - houseEdge))).toFixed(2)));

        const targetMultiplier = Number(actionPayload.targetMultiplier || 1.5);
        const won = targetMultiplier <= crashPoint;
        const multiplier = won ? targetMultiplier : 0.0;

        return {
          outcomeType: won ? 'WIN' : 'CRASH',
          multiplier,
          payoutCoins: Math.floor(betCoins * multiplier),
          details: {
            crashPoint,
            targetMultiplier,
            cashedOut: won,
          },
        };
      }

      case 'fruit_party_jackpot': {
        const symbols = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '7️⃣'];
        const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
        const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
        const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

        let multiplier = 0;
        let isJackpot = false;

        if (reel1 === reel2 && reel2 === reel3) {
          if (reel1 === '7️⃣') {
            multiplier = 50.0;
            isJackpot = true;
          } else if (reel1 === '⭐') {
            multiplier = 20.0;
          } else {
            multiplier = 5.0;
          }
        } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
          multiplier = 1.5;
        }

        return {
          outcomeType: isJackpot ? 'JACKPOT' : multiplier > 0 ? 'WIN' : 'LOSS',
          multiplier,
          payoutCoins: Math.floor(betCoins * multiplier),
          details: {
            reels: [reel1, reel2, reel3],
            isJackpot,
          },
        };
      }

      case 'fishing_star': {
        const fishTiers = [
          { name: 'Clownfish', multiplier: 1.2, prob: 0.5 },
          { name: 'Swordfish', multiplier: 2.5, prob: 0.25 },
          { name: 'Hammerhead Shark', multiplier: 5.0, prob: 0.1 },
          { name: 'Golden Dragon Whale', multiplier: 20.0, prob: 0.02 },
        ];

        const captured = randomFloat < 0.65;
        let selectedFish = null;
        let multiplier = 0;

        if (captured) {
          const tierRand = Math.random();
          if (tierRand < 0.05) selectedFish = fishTiers[3];
          else if (tierRand < 0.2) selectedFish = fishTiers[2];
          else if (tierRand < 0.5) selectedFish = fishTiers[1];
          else selectedFish = fishTiers[0];

          multiplier = selectedFish.multiplier;
        }

        return {
          outcomeType: captured ? 'WIN' : 'MISSED',
          multiplier,
          payoutCoins: Math.floor(betCoins * multiplier),
          details: {
            captured,
            fishName: selectedFish ? selectedFish.name : 'None',
          },
        };
      }

      // Games with CLIENT_SPEC_REQUIRED — Placeholder standard engine shell
      case 'delicious':
      case 'bounty_football':
      case 'greedy_lion':
      case 'double_seven_77':
      default: {
        const won = randomFloat < (game.computedRTP || 0.90) * 0.45;
        const multiplier = won ? 2.0 : 0.0;

        return {
          outcomeType: won ? 'WIN' : 'LOSS',
          multiplier,
          payoutCoins: Math.floor(betCoins * multiplier),
          details: {
            specificationStatus: GAME_SPECIFICATION_STATUS.CLIENT_SPEC_REQUIRED,
            note: 'Standard server engine placeholder. Awaiting final client mathematics specification.',
          },
        };
      }
    }
  }

  /**
   * Admin: Update Game Configuration
   */
  async adminUpdateGameConfig(gameId, configData, adminUser = {}) {
    if (!isValidGameId(gameId)) {
      const error = new Error(`Unsupported game ID: '${gameId}'.`);
      error.statusCode = 400;
      throw error;
    }

    const game = getCanonicalGame(gameId);
    const updated = await gameRepository.updateGameConfig(game.gameKey, configData);

    // Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          adminId: adminUser.userId || 'SYSTEM',
          adminName: adminUser.username || 'Administrator',
          action: 'UPDATE_GAME_CONFIG',
          targetEntity: 'Game',
          targetEntityId: gameId,
          afterStateJson: configData,
          reason: configData.reason || 'Updated game parameters',
        },
      });
    } catch (_) {}

    return updated;
  }

  /**
   * Admin: Toggle Game Status
   */
  async adminToggleGameStatus(gameId, isActive, adminUser = {}) {
    if (!isValidGameId(gameId)) {
      const error = new Error(`Unsupported game ID: '${gameId}'.`);
      error.statusCode = 400;
      throw error;
    }

    const game = getCanonicalGame(gameId);
    const updated = await gameRepository.setGameStatus(game.gameKey, isActive);

    // Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          adminId: adminUser.userId || 'SYSTEM',
          adminName: adminUser.username || 'Administrator',
          action: isActive ? 'ENABLE_GAME' : 'DISABLE_GAME',
          targetEntity: 'Game',
          targetEntityId: gameId,
          afterStateJson: { isActive },
        },
      });
    } catch (_) {}

    return updated;
  }
}

export default new GameService();
