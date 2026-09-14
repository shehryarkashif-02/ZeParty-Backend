import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_GAMES,
  OFFICIAL_GAME_IDS,
  OFFICIAL_GAME_KEYS,
  isValidGameId,
  getCanonicalGame,
  GAME_SPECIFICATION_STATUS,
} from '../src/constants/game.constants.js';
import gameService from '../src/services/game.service.js';

test('Official 10-Game Catalog & Architectural Enforcement Suite', async (t) => {
  await t.test('1. Canonical catalog contains EXACTLY 10 approved games', () => {
    assert.equal(CANONICAL_GAMES.length, 10, 'Catalog must contain exactly 10 games');
    assert.equal(OFFICIAL_GAME_IDS.length, 10, 'Official game IDs must contain exactly 10 IDs');

    const expectedGameIds = [
      'fishing_star',
      'teen_patti',
      'dragon_tiger',
      'roulette',
      'delicious',
      'rocket',
      'fruit_party_jackpot',
      'bounty_football',
      'greedy_lion',
      'double_seven_77',
    ];

    expectedGameIds.forEach((id) => {
      assert.ok(OFFICIAL_GAME_IDS.includes(id), `Expected official game ID '${id}' to exist in catalog`);
      const game = getCanonicalGame(id);
      assert.ok(game, `Expected game metadata for '${id}'`);
      assert.equal(game.id, id);
      assert.ok(game.name, `Game '${id}' must have a valid display name`);
      assert.ok(game.minBetCoins > 0, `Game '${id}' must have minBetCoins > 0`);
      assert.ok(game.maxBetCoins >= game.minBetCoins, `Game '${id}' maxBetCoins must be >= minBetCoins`);
    });
  });

  await t.test('2. Removed and legacy games are strictly rejected', () => {
    const removedGames = [
      'wheel_of_fortune',
      'lucky_wheel',
      'diamond_rush',
      'card_battle',
      'treasure_chest',
      'treasure_box',
      'lucky_dice',
      'dice',
      'coin_flip',
      'coin_flip_double',
      'slots',
      'poker',
      'blackjack',
      'aviator',
    ];

    removedGames.forEach((removedId) => {
      assert.equal(isValidGameId(removedId), false, `Removed game '${removedId}' must NOT be valid`);
      assert.equal(getCanonicalGame(removedId), null, `Removed game '${removedId}' must return null from catalog`);
    });
  });

  await t.test('3. Service rejects attempts to fetch or play removed games', async () => {
    await assert.rejects(
      async () => {
        await gameService.getGameById('wheel_of_fortune');
      },
      (err) => {
        assert.equal(err.code, 'UNSUPPORTED_GAME');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await gameService.playRound({
          userId: 'test-user-1',
          gameId: 'dice',
          betCoins: 50,
        });
      },
      (err) => {
        assert.equal(err.code, 'UNSUPPORTED_GAME');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  await t.test('4. Specification gaps are explicitly documented and marked', () => {
    const specRequiredGames = ['delicious', 'bounty_football', 'greedy_lion', 'double_seven_77'];

    specRequiredGames.forEach((gameId) => {
      const game = getCanonicalGame(gameId);
      assert.ok(game, `Game '${gameId}' must exist`);
      assert.equal(
        game.specificationStatus,
        GAME_SPECIFICATION_STATUS.CLIENT_SPEC_REQUIRED,
        `Game '${gameId}' must be flagged as CLIENT_SPEC_REQUIRED`
      );
    });

    const definedGames = ['fishing_star', 'teen_patti', 'dragon_tiger', 'roulette', 'rocket', 'fruit_party_jackpot'];
    definedGames.forEach((gameId) => {
      const game = getCanonicalGame(gameId);
      assert.notEqual(
        game.specificationStatus,
        GAME_SPECIFICATION_STATUS.CLIENT_SPEC_REQUIRED,
        `Game '${gameId}' should have its standard identity defined`
      );
    });
  });

  await t.test('5. Bet amount validation enforces boundaries', async () => {
    // Bet below min
    await assert.rejects(
      async () => {
        await gameService.playRound({
          userId: 'test-user-1',
          gameId: 'teen_patti',
          betCoins: 5, // Teen Patti min is 20
        });
      },
      (err) => {
        assert.equal(err.code, 'BET_OUT_OF_BOUNDS');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Invalid / negative bet
    await assert.rejects(
      async () => {
        await gameService.playRound({
          userId: 'test-user-1',
          gameId: 'teen_patti',
          betCoins: -50,
        });
      },
      (err) => {
        assert.equal(err.code, 'INVALID_BET_AMOUNT');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  await t.test('6. Server-authoritative outcome generation produces valid results', () => {
    OFFICIAL_GAME_IDS.forEach((gameId) => {
      const game = getCanonicalGame(gameId);
      const outcome = gameService._calculateGameOutcome(gameId, 100, {}, game);

      assert.ok(outcome, `Outcome must be generated for ${gameId}`);
      assert.ok(typeof outcome.multiplier === 'number', `Multiplier must be a number for ${gameId}`);
      assert.ok(typeof outcome.payoutCoins === 'number', `PayoutCoins must be a number for ${gameId}`);
      assert.ok(outcome.outcomeType, `OutcomeType must be present for ${gameId}`);
      assert.ok(outcome.details, `Details must be present for ${gameId}`);
    });
  });
});
