import { STARTING_COINS } from '../engine';
import type { PuzzleKind } from '../engine';
import { PUZZLE_KINDS } from '../engine';

/** Bumped whenever the stored shape changes; see `migrate` in progressStore. */
export const PROGRESS_VERSION = 1;

export interface DailyProgress {
  /** Local date key (YYYY-MM-DD) of the last completed daily challenge. */
  readonly lastCompletedKey: string | null;
  readonly lastScore: number;
  readonly bestScore: number;
  /** Consecutive days completed. */
  readonly currentStreak: number;
  readonly bestStreak: number;
}

export interface Settings {
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  /** Personalised ads are opt-in; the default is the privacy-preserving one. */
  readonly personalisedAds: boolean;
}

export interface KindStat {
  readonly seen: number;
  readonly correct: number;
}

export interface ProgressState {
  readonly version: number;
  readonly coins: number;
  readonly totalGames: number;
  readonly totalAnswered: number;
  readonly totalCorrect: number;
  readonly bestScore: number;
  /** Answer streak carried out of the most recent run. */
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly daily: DailyProgress;
  readonly settings: Settings;
  readonly kindStats: Readonly<Record<PuzzleKind, KindStat>>;
}

function emptyKindStats(): Record<PuzzleKind, KindStat> {
  const stats = {} as Record<PuzzleKind, KindStat>;
  for (const kind of PUZZLE_KINDS) stats[kind] = { seen: 0, correct: 0 };
  return stats;
}

export function defaultProgress(): ProgressState {
  return {
    version: PROGRESS_VERSION,
    coins: STARTING_COINS,
    totalGames: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    bestScore: 0,
    currentStreak: 0,
    bestStreak: 0,
    daily: {
      lastCompletedKey: null,
      lastScore: 0,
      bestScore: 0,
      currentStreak: 0,
      bestStreak: 0,
    },
    settings: {
      soundEnabled: true,
      hapticsEnabled: true,
      personalisedAds: false,
    },
    kindStats: emptyKindStats(),
  };
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Rebuilds a valid state from whatever was on disk.
 *
 * Storage can hold anything: a half-written record from a killed process, a
 * payload from an older build, or nothing at all. Every field is validated
 * individually and falls back to its default, so a corrupt value costs the
 * player that one field rather than their whole save.
 */
export function reviveProgress(raw: unknown): ProgressState {
  const defaults = defaultProgress();
  if (typeof raw !== 'object' || raw === null) return defaults;

  const input = raw as Record<string, unknown>;
  const dailyInput = (typeof input.daily === 'object' && input.daily !== null
    ? input.daily
    : {}) as Record<string, unknown>;
  const settingsInput = (typeof input.settings === 'object' && input.settings !== null
    ? input.settings
    : {}) as Record<string, unknown>;
  const kindInput = (typeof input.kindStats === 'object' && input.kindStats !== null
    ? input.kindStats
    : {}) as Record<string, unknown>;

  const kindStats = emptyKindStats();
  for (const kind of PUZZLE_KINDS) {
    const entry = kindInput[kind];
    if (typeof entry === 'object' && entry !== null) {
      const record = entry as Record<string, unknown>;
      kindStats[kind] = {
        seen: Math.max(0, asNumber(record.seen, 0)),
        correct: Math.max(0, asNumber(record.correct, 0)),
      };
    }
  }

  const lastCompletedKey =
    typeof dailyInput.lastCompletedKey === 'string' ? dailyInput.lastCompletedKey : null;

  return {
    version: PROGRESS_VERSION,
    coins: Math.max(0, Math.round(asNumber(input.coins, defaults.coins))),
    totalGames: Math.max(0, asNumber(input.totalGames, 0)),
    totalAnswered: Math.max(0, asNumber(input.totalAnswered, 0)),
    totalCorrect: Math.max(0, asNumber(input.totalCorrect, 0)),
    bestScore: Math.max(0, asNumber(input.bestScore, 0)),
    currentStreak: Math.max(0, asNumber(input.currentStreak, 0)),
    bestStreak: Math.max(0, asNumber(input.bestStreak, 0)),
    daily: {
      lastCompletedKey,
      lastScore: Math.max(0, asNumber(dailyInput.lastScore, 0)),
      bestScore: Math.max(0, asNumber(dailyInput.bestScore, 0)),
      currentStreak: Math.max(0, asNumber(dailyInput.currentStreak, 0)),
      bestStreak: Math.max(0, asNumber(dailyInput.bestStreak, 0)),
    },
    settings: {
      soundEnabled: asBoolean(settingsInput.soundEnabled, true),
      hapticsEnabled: asBoolean(settingsInput.hapticsEnabled, true),
      personalisedAds: asBoolean(settingsInput.personalisedAds, false),
    },
    kindStats,
  };
}
