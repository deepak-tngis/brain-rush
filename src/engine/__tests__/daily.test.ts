import { advanceDailyStreak, dailyConfig, dailyKey, dailySeed, daysBetween } from '../daily';
import { createSession, DAILY_QUESTION_COUNT } from '../session';

describe('daily keys and seeds', () => {
  it('formats the local date as YYYY-MM-DD', () => {
    expect(dailyKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dailyKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('gives the same seed for the same day and a different one for another day', () => {
    expect(dailySeed('2026-03-14')).toBe(dailySeed('2026-03-14'));
    expect(dailySeed('2026-03-14')).not.toBe(dailySeed('2026-03-15'));
  });

  it('produces an identical ten-puzzle challenge for a given day', () => {
    const first = createSession(dailyConfig('2026-06-01'));
    const second = createSession(dailyConfig('2026-06-01'));
    expect(first.puzzles).toHaveLength(DAILY_QUESTION_COUNT);
    expect(JSON.stringify(second.puzzles)).toBe(JSON.stringify(first.puzzles));
  });

  it('produces a different challenge on a different day', () => {
    const monday = createSession(dailyConfig('2026-06-01'));
    const tuesday = createSession(dailyConfig('2026-06-02'));
    expect(JSON.stringify(tuesday.puzzles)).not.toBe(JSON.stringify(monday.puzzles));
  });

  it('generates a clean challenge for every day of a year', () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    for (let day = 0; day < 365; day += 1) {
      const date = new Date(start.getTime() + day * 24 * 60 * 60 * 1000);
      const key = `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, '0')}-${`${date.getUTCDate()}`.padStart(2, '0')}`;
      expect(() => createSession(dailyConfig(key))).not.toThrow();
    }
  });
});

describe('daysBetween', () => {
  it('counts whole days and survives month and year boundaries', () => {
    expect(daysBetween('2026-03-14', '2026-03-15')).toBe(1);
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0);
    expect(daysBetween('2026-03-01', '2026-03-09')).toBe(8);
  });
});

describe('daily streaks', () => {
  it('starts a streak on the first ever completion', () => {
    expect(advanceDailyStreak(null, '2026-05-01', 0, 0)).toEqual({
      currentStreak: 1,
      bestStreak: 1,
    });
  });

  it('extends the streak on consecutive days', () => {
    expect(advanceDailyStreak('2026-05-01', '2026-05-02', 1, 1)).toEqual({
      currentStreak: 2,
      bestStreak: 2,
    });
  });

  it('resets the streak after a missed day but keeps the best', () => {
    expect(advanceDailyStreak('2026-05-01', '2026-05-04', 7, 7)).toEqual({
      currentStreak: 1,
      bestStreak: 7,
    });
  });

  it('is idempotent when the same day is completed twice', () => {
    expect(advanceDailyStreak('2026-05-02', '2026-05-02', 3, 9)).toEqual({
      currentStreak: 3,
      bestStreak: 9,
    });
  });
});
