import AsyncStorage from '@react-native-async-storage/async-storage';

import { advanceDailyStreak, dailyKey } from '../engine';
import type { PuzzleKind, SessionState } from '../engine';
import { COINS_DAILY_COMPLETION } from '../engine';
import { defaultProgress, reviveProgress } from './schema';
import type { ProgressState, Settings } from './schema';

const STORAGE_KEY = 'brain-rush/progress/v1';

/**
 * Writes are coalesced: a run can touch the store several times a second, and
 * Android's AsyncStorage is a real disk write each time.
 */
const WRITE_DEBOUNCE_MS = 400;

type Listener = () => void;

let state: ProgressState = defaultProgress();
let hydrated = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let writeInFlight: Promise<void> = Promise.resolve();
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

function scheduleWrite(): void {
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void flush();
  }, WRITE_DEBOUNCE_MS);
}

/**
 * Forces any pending write to disk. Called when the app is backgrounded so a
 * swipe-away never costs the player the run they just finished.
 */
export function flush(): Promise<void> {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  const snapshot = state;
  writeInFlight = writeInFlight
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)))
    .catch(() => {
      // A failed write must never take the game down with it; the in-memory
      // state stays authoritative and the next change tries again.
    });
  return writeInFlight;
}

function update(producer: (current: ProgressState) => ProgressState): ProgressState {
  const next = producer(state);
  if (next === state) return state;
  state = next;
  emit();
  scheduleWrite();
  return state;
}

export function getProgress(): ProgressState {
  return state;
}

export function isHydrated(): boolean {
  return hydrated;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reads the saved game once at start-up. Never throws. */
export async function hydrate(): Promise<ProgressState> {
  if (hydrated) return state;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    state = raw === null ? defaultProgress() : reviveProgress(JSON.parse(raw));
  } catch {
    // Unreadable or corrupt storage starts a fresh save rather than blocking play.
    state = defaultProgress();
  }
  hydrated = true;
  emit();
  return state;
}

export function addCoins(amount: number): void {
  if (amount === 0) return;
  update((current) => ({ ...current, coins: Math.max(0, current.coins + amount) }));
}

/** Returns false (and spends nothing) when the player cannot afford it. */
export function spendCoins(amount: number): boolean {
  if (amount <= 0) return true;
  if (state.coins < amount) return false;
  update((current) => ({ ...current, coins: Math.max(0, current.coins - amount) }));
  return true;
}

export function recordAnswer(kind: PuzzleKind, correct: boolean, streak: number): void {
  update((current) => {
    const stat = current.kindStats[kind];
    return {
      ...current,
      totalAnswered: current.totalAnswered + 1,
      totalCorrect: current.totalCorrect + (correct ? 1 : 0),
      currentStreak: streak,
      bestStreak: Math.max(current.bestStreak, streak),
      kindStats: {
        ...current.kindStats,
        [kind]: {
          seen: stat.seen + 1,
          correct: stat.correct + (correct ? 1 : 0),
        },
      },
    };
  });
}

export interface RunSummary {
  readonly score: number;
  readonly bestStreakInRun: number;
  /**
   * False when the run is being re-banked after the player continued past a
   * game over: the bests still update, but the run is only counted once.
   */
  readonly countsAsGame: boolean;
}

/**
 * Banks a finished run's bests.
 *
 * Coins are *not* handled here — they are credited the moment each answer lands
 * (see `awardCoins`), so a player who closes the app on the game-over screen
 * keeps everything they earned.
 */
export function recordRunFinished(summary: RunSummary): void {
  update((current) => ({
    ...current,
    totalGames: current.totalGames + (summary.countsAsGame ? 1 : 0),
    bestScore: Math.max(current.bestScore, summary.score),
    bestStreak: Math.max(current.bestStreak, summary.bestStreakInRun),
    currentStreak: 0,
  }));
}

/** Credits coins the instant they are earned, mid-run. */
export function awardCoins(amount: number): void {
  addCoins(amount);
}

export interface DailyResult {
  readonly key: string;
  readonly score: number;
  readonly bestStreakInRun: number;
  readonly countsAsGame: boolean;
}

/**
 * Banks a completed daily challenge, including the completion bonus and the
 * day-streak roll-forward. Completing the same day twice is a no-op for the
 * bonus, so replays cannot farm coins.
 */
export function recordDailyCompleted(result: DailyResult): void {
  update((current) => {
    const alreadyDone = current.daily.lastCompletedKey === result.key;
    const streaks = advanceDailyStreak(
      current.daily.lastCompletedKey,
      result.key,
      current.daily.currentStreak,
      current.daily.bestStreak,
    );
    const bonus = alreadyDone ? 0 : COINS_DAILY_COMPLETION;

    return {
      ...current,
      coins: Math.max(0, current.coins + bonus),
      totalGames: current.totalGames + (result.countsAsGame ? 1 : 0),
      bestScore: Math.max(current.bestScore, result.score),
      bestStreak: Math.max(current.bestStreak, result.bestStreakInRun),
      currentStreak: 0,
      daily: {
        lastCompletedKey: result.key,
        lastScore: result.score,
        bestScore: Math.max(current.daily.bestScore, result.score),
        currentStreak: streaks.currentStreak,
        bestStreak: streaks.bestStreak,
      },
    };
  });
}

export function updateSettings(patch: Partial<Settings>): void {
  update((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
}

export function isDailyCompleted(key: string = dailyKey()): boolean {
  return state.daily.lastCompletedKey === key;
}

/** Wipes the save. Only reachable from Settings, behind a confirmation. */
export async function resetProgress(): Promise<void> {
  state = defaultProgress();
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory reset already happened; a failed delete retries on next write.
  }
}

/**
 * Banks a finished run.
 *
 * A completed daily goes to the daily record (which pays the completion bonus
 * once per day); everything else updates the endless bests.
 */
export function bankSession(
  session: SessionState,
  key: string | null,
  countsAsGame = true,
): void {
  const summary = {
    score: session.score,
    bestStreakInRun: session.bestStreakInRun,
    countsAsGame,
  };
  if (session.config.mode === 'daily' && session.status === 'completed' && key !== null) {
    recordDailyCompleted({ ...summary, key });
    return;
  }
  recordRunFinished(summary);
}

/** Test seam: resets module state without touching the device. */
export function __resetForTests(next: ProgressState = defaultProgress()): void {
  state = next;
  hydrated = true;
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  emit();
}

/** Test seam: simulates a cold start so `hydrate` reads from storage again. */
export function __unhydrateForTests(): void {
  state = defaultProgress();
  hydrated = false;
}
