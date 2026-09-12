import { COINS_DAILY_COMPLETION, STARTING_COINS } from '../../engine';
import { __clear, __seed, __snapshot } from '../../testing/asyncStorageMock';
import {
  __resetForTests,
  __unhydrateForTests,
  addCoins,
  awardCoins,
  bankSession,
  flush,
  getProgress,
  hydrate,
  isDailyCompleted,
  recordAnswer,
  recordDailyCompleted,
  recordRunFinished,
  resetProgress,
  spendCoins,
  updateSettings,
} from '../progressStore';
import { defaultProgress, reviveProgress } from '../schema';

const STORAGE_KEY = 'brain-rush/progress/v1';

beforeEach(() => {
  __clear();
  __resetForTests();
});

describe('defaults', () => {
  it('starts the player with 300 coins and three clean slates', () => {
    const progress = getProgress();
    expect(progress.coins).toBe(STARTING_COINS);
    expect(progress.bestScore).toBe(0);
    expect(progress.bestStreak).toBe(0);
    expect(progress.daily.lastCompletedKey).toBeNull();
  });
});

describe('coins', () => {
  it('adds and spends', () => {
    addCoins(120);
    expect(getProgress().coins).toBe(STARTING_COINS + 120);
    expect(spendCoins(20)).toBe(true);
    expect(getProgress().coins).toBe(STARTING_COINS + 100);
  });

  it('refuses to spend more than the player has, and changes nothing', () => {
    expect(spendCoins(STARTING_COINS + 1)).toBe(false);
    expect(getProgress().coins).toBe(STARTING_COINS);
  });

  it('never goes negative', () => {
    addCoins(-99999);
    expect(getProgress().coins).toBe(0);
  });
});

describe('runs', () => {
  it('banks best score, best streak and the game count', () => {
    recordRunFinished({ score: 250, bestStreakInRun: 8, countsAsGame: true });
    const progress = getProgress();
    expect(progress.bestScore).toBe(250);
    expect(progress.bestStreak).toBe(8);
    expect(progress.totalGames).toBe(1);
  });

  it('keeps the better of the old and new bests', () => {
    recordRunFinished({ score: 250, bestStreakInRun: 8, countsAsGame: true });
    recordRunFinished({ score: 100, bestStreakInRun: 3, countsAsGame: true });
    expect(getProgress().bestScore).toBe(250);
    expect(getProgress().bestStreak).toBe(8);
    expect(getProgress().totalGames).toBe(2);
  });

  it('counts a run once even when the player continues past a game over', () => {
    recordRunFinished({ score: 120, bestStreakInRun: 4, countsAsGame: true });
    recordRunFinished({ score: 300, bestStreakInRun: 9, countsAsGame: false });
    expect(getProgress().totalGames).toBe(1);
    expect(getProgress().bestScore).toBe(300);
    expect(getProgress().bestStreak).toBe(9);
  });

  it('credits coins as they are earned rather than at the end of a run', () => {
    awardCoins(35);
    expect(getProgress().coins).toBe(STARTING_COINS + 35);
    recordRunFinished({ score: 10, bestStreakInRun: 1, countsAsGame: true });
    expect(getProgress().coins).toBe(STARTING_COINS + 35);
  });

  it('tracks accuracy per puzzle type', () => {
    recordAnswer('quickMath', true, 1);
    recordAnswer('quickMath', false, 0);
    recordAnswer('memory', true, 1);
    const progress = getProgress();
    expect(progress.kindStats.quickMath).toEqual({ seen: 2, correct: 1 });
    expect(progress.kindStats.memory).toEqual({ seen: 1, correct: 1 });
    expect(progress.totalAnswered).toBe(3);
    expect(progress.totalCorrect).toBe(2);
  });

  it('raises the best streak as answers land', () => {
    recordAnswer('matching', true, 4);
    recordAnswer('matching', true, 5);
    recordAnswer('matching', false, 0);
    expect(getProgress().bestStreak).toBe(5);
    expect(getProgress().currentStreak).toBe(0);
  });
});

describe('daily challenge', () => {
  it('pays the completion bonus and starts the day streak', () => {
    recordDailyCompleted({ key: '2026-05-01', score: 120, bestStreakInRun: 6, countsAsGame: true });
    const progress = getProgress();
    expect(progress.coins).toBe(STARTING_COINS + COINS_DAILY_COMPLETION);
    expect(progress.daily.currentStreak).toBe(1);
    expect(progress.daily.bestScore).toBe(120);
    expect(isDailyCompleted('2026-05-01')).toBe(true);
    expect(isDailyCompleted('2026-05-02')).toBe(false);
  });

  it('pays the completion bonus once per day, however often it is replayed', () => {
    recordDailyCompleted({ key: '2026-05-01', score: 120, bestStreakInRun: 6, countsAsGame: true });
    const afterFirst = getProgress().coins;
    recordDailyCompleted({ key: '2026-05-01', score: 90, bestStreakInRun: 2, countsAsGame: true });
    expect(getProgress().coins).toBe(afterFirst);
    expect(getProgress().daily.currentStreak).toBe(1);
  });

  it('extends the streak on consecutive days and keeps the best score', () => {
    recordDailyCompleted({ key: '2026-05-01', score: 120, bestStreakInRun: 0, countsAsGame: true });
    recordDailyCompleted({ key: '2026-05-02', score: 90, bestStreakInRun: 0, countsAsGame: true });
    expect(getProgress().daily.currentStreak).toBe(2);
    expect(getProgress().daily.bestScore).toBe(120);
    expect(getProgress().daily.lastScore).toBe(90);
  });

  it('routes a completed daily run to the daily record, and any other run to the endless one', () => {
    bankSession(
      {
        config: { mode: 'daily', seed: 1 },
        status: 'completed',
        score: 200,
        coinsEarned: 50,
        bestStreakInRun: 10,
      } as never,
      '2026-05-05',
    );
    expect(getProgress().daily.lastCompletedKey).toBe('2026-05-05');

    bankSession(
      {
        config: { mode: 'endless', seed: 2 },
        status: 'gameOver',
        score: 40,
        coinsEarned: 10,
        bestStreakInRun: 2,
      } as never,
      null,
    );
    expect(getProgress().daily.lastCompletedKey).toBe('2026-05-05');
    expect(getProgress().totalGames).toBe(2);
  });
});

describe('persistence across restarts', () => {
  it('writes the save and reads it back', async () => {
    awardCoins(95);
    recordRunFinished({ score: 480, bestStreakInRun: 12, countsAsGame: true });
    updateSettings({ soundEnabled: false });
    await flush();

    expect(__snapshot()[STORAGE_KEY]).toBeDefined();

    // Simulate a cold start: module state forgotten, storage untouched.
    __unhydrateForTests();
    expect(getProgress().bestScore).toBe(0);

    const restored = await hydrate();
    expect(restored.bestScore).toBe(480);
    expect(restored.coins).toBe(STARTING_COINS + 95);
    expect(restored.bestStreak).toBe(12);
    expect(restored.settings.soundEnabled).toBe(false);
  });

  it('falls back to a clean save when storage holds nonsense', async () => {
    __seed(STORAGE_KEY, '{"coins": "lots", "bestScore": null, "daily": 7}');
    __resetForTests();
    const revived = reviveProgress(JSON.parse(__snapshot()[STORAGE_KEY] as string));
    expect(revived.coins).toBe(STARTING_COINS);
    expect(revived.bestScore).toBe(0);
    expect(revived.daily.lastCompletedKey).toBeNull();
  });

  it('survives storage that cannot be parsed at all', async () => {
    __seed(STORAGE_KEY, 'not json');
    __unhydrateForTests();
    const progress = await hydrate();
    expect(progress).toEqual(defaultProgress());
  });

  it('clears everything on reset', async () => {
    addCoins(500);
    await resetProgress();
    expect(getProgress().coins).toBe(STARTING_COINS);
    expect(__snapshot()[STORAGE_KEY]).toBeUndefined();
  });
});

describe('reviveProgress', () => {
  it('rejects negative and non-numeric values field by field', () => {
    const revived = reviveProgress({
      coins: -50,
      bestScore: 'high',
      totalGames: 3,
      kindStats: { quickMath: { seen: 4, correct: 2 }, bogus: { seen: 1 } },
      settings: { soundEnabled: 'yes', hapticsEnabled: false },
    });
    expect(revived.coins).toBe(0);
    expect(revived.bestScore).toBe(0);
    expect(revived.totalGames).toBe(3);
    expect(revived.kindStats.quickMath).toEqual({ seen: 4, correct: 2 });
    expect(revived.settings.soundEnabled).toBe(true);
    expect(revived.settings.hapticsEnabled).toBe(false);
  });

  it('turns anything that is not an object into a clean save', () => {
    expect(reviveProgress(null)).toEqual(defaultProgress());
    expect(reviveProgress('nope')).toEqual(defaultProgress());
    expect(reviveProgress(42)).toEqual(defaultProgress());
  });
});
