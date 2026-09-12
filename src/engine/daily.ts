import { hashSeed } from './rng';
import { DAILY_QUESTION_COUNT } from './session';
import type { SessionConfig } from './session';

/**
 * The daily challenge is generated, not downloaded.
 *
 * The date string is the only input, so every device produces the same ten
 * puzzles for the same day with no network, no account and no clock skew beyond
 * the device's own local date.
 */
export function dailyKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailySeed(key: string): number {
  return hashSeed('brain-rush-daily', key);
}

export function dailyConfig(key: string = dailyKey()): SessionConfig {
  return {
    mode: 'daily',
    seed: dailySeed(key),
    questionCount: DAILY_QUESTION_COUNT,
  };
}

/** Local-date difference in whole days; used to decide if a streak survived. */
export function daysBetween(fromKey: string, toKey: string): number {
  const from = parseKey(fromKey);
  const to = parseKey(toKey);
  if (from === null || to === null) return Number.NaN;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function parseKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (match === null) return null;
  // Construct at UTC midnight so arithmetic is immune to DST transitions.
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export interface DailyStreakUpdate {
  readonly currentStreak: number;
  readonly bestStreak: number;
}

/**
 * Recomputes the day streak after completing today's challenge.
 *
 * Completing on consecutive days extends the streak; a gap resets it to 1; a
 * repeat completion on the same day changes nothing.
 */
export function advanceDailyStreak(
  lastCompletedKey: string | null,
  todayKey: string,
  currentStreak: number,
  bestStreak: number,
): DailyStreakUpdate {
  if (lastCompletedKey === todayKey) {
    return { currentStreak, bestStreak };
  }
  const gap = lastCompletedKey === null ? Number.NaN : daysBetween(lastCompletedKey, todayKey);
  const nextStreak = gap === 1 ? currentStreak + 1 : 1;
  return { currentStreak: nextStreak, bestStreak: Math.max(bestStreak, nextStreak) };
}
