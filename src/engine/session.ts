import { createPuzzle } from './puzzleFactory';
import {
  COINS_PER_CORRECT,
  MAX_LIVES,
  POINTS_PER_CORRECT,
  STARTING_LIVES,
  speedBonusPoints,
  streakBonusCoins,
} from './scoring';
import type { Puzzle, PuzzleKind } from './types';

export type GameMode = 'endless' | 'daily';
export type SessionStatus = 'playing' | 'gameOver' | 'completed';

export interface SessionConfig {
  readonly mode: GameMode;
  readonly seed: number;
  /** Daily runs are a fixed length; endless runs keep going until lives run out. */
  readonly questionCount?: number;
  readonly startingLives?: number;
}

export interface AnswerOutcome {
  readonly correct: boolean;
  readonly pointsAwarded: number;
  readonly coinsAwarded: number;
  readonly streakBonusCoins: number;
  readonly livesLost: number;
  /** True when this answer pushed the streak past the player's previous best. */
  readonly newBestStreak: boolean;
  readonly timedOut: boolean;
}

export interface SessionState {
  readonly config: SessionConfig;
  readonly status: SessionStatus;
  /** Puzzles generated so far; endless mode appends lazily. */
  readonly puzzles: readonly Puzzle[];
  readonly index: number;
  readonly score: number;
  readonly coinsEarned: number;
  readonly lives: number;
  readonly streak: number;
  readonly bestStreakInRun: number;
  readonly correctCount: number;
  readonly wrongCount: number;
  /** Rewarded-ad reveals used, so the UI can show what happened afterwards. */
  readonly revealedPuzzleIds: readonly string[];
  readonly lastOutcome: AnswerOutcome | null;
}

/** Endless mode still needs a horizon to generate against; it extends on demand. */
const ENDLESS_LOOKAHEAD = 6;
export const DAILY_QUESTION_COUNT = 10;

function generateUpTo(seed: number, existing: readonly Puzzle[], target: number): Puzzle[] {
  const puzzles = existing.slice();
  while (puzzles.length < target) {
    const avoid: PuzzleKind[] = puzzles.slice(-2).map((puzzle) => puzzle.kind);
    puzzles.push(createPuzzle({ seed, index: puzzles.length, avoid }));
  }
  return puzzles;
}

export function createSession(config: SessionConfig): SessionState {
  const target =
    config.mode === 'daily'
      ? (config.questionCount ?? DAILY_QUESTION_COUNT)
      : ENDLESS_LOOKAHEAD;

  return {
    config,
    status: 'playing',
    puzzles: generateUpTo(config.seed, [], target),
    index: 0,
    score: 0,
    coinsEarned: 0,
    lives: config.startingLives ?? STARTING_LIVES,
    streak: 0,
    bestStreakInRun: 0,
    correctCount: 0,
    wrongCount: 0,
    revealedPuzzleIds: [],
    lastOutcome: null,
  };
}

export function currentPuzzle(state: SessionState): Puzzle | null {
  return state.puzzles[state.index] ?? null;
}

export function totalQuestions(state: SessionState): number | null {
  if (state.config.mode !== 'daily') return null;
  return state.config.questionCount ?? DAILY_QUESTION_COUNT;
}

export interface AnswerInput {
  readonly optionId: string | null;
  readonly elapsedMs: number;
  /** A run-out clock is scored as a wrong answer, not as a free pass. */
  readonly timedOut?: boolean;
}

/**
 * Applies one answer. Pure: same state plus same input always yields the same
 * next state, which is what makes the whole scoring economy testable.
 */
export function answerCurrent(state: SessionState, input: AnswerInput): SessionState {
  const puzzle = currentPuzzle(state);
  if (state.status !== 'playing' || puzzle === null) return state;

  const timedOut = input.timedOut ?? false;
  const correct = !timedOut && input.optionId === puzzle.answerId;

  if (!correct) {
    const lives = Math.max(0, state.lives - 1);
    return {
      ...state,
      lives,
      streak: 0,
      wrongCount: state.wrongCount + 1,
      status: lives === 0 ? 'gameOver' : state.status,
      lastOutcome: {
        correct: false,
        pointsAwarded: 0,
        coinsAwarded: 0,
        streakBonusCoins: 0,
        livesLost: 1,
        newBestStreak: false,
        timedOut,
      },
    };
  }

  const streak = state.streak + 1;
  const bonus = streakBonusCoins(streak);
  const points = POINTS_PER_CORRECT + speedBonusPoints(input.elapsedMs, puzzle.timeLimitMs);
  const coins = COINS_PER_CORRECT + bonus;

  return {
    ...state,
    score: state.score + points,
    coinsEarned: state.coinsEarned + coins,
    streak,
    bestStreakInRun: Math.max(state.bestStreakInRun, streak),
    correctCount: state.correctCount + 1,
    lastOutcome: {
      correct: true,
      pointsAwarded: points,
      coinsAwarded: coins,
      streakBonusCoins: bonus,
      livesLost: 0,
      newBestStreak: streak > state.bestStreakInRun,
      timedOut: false,
    },
  };
}

/** Advances to the next puzzle, generating more in endless mode as needed. */
export function advance(state: SessionState): SessionState {
  if (state.status !== 'playing') return state;

  const nextIndex = state.index + 1;
  const limit = totalQuestions(state);

  if (limit !== null && nextIndex >= limit) {
    return { ...state, index: limit, status: 'completed', lastOutcome: null };
  }

  const puzzles =
    limit === null
      ? generateUpTo(state.config.seed, state.puzzles, nextIndex + ENDLESS_LOOKAHEAD)
      : state.puzzles;

  return { ...state, index: nextIndex, puzzles, lastOutcome: null };
}

/**
 * Rewarded-ad reward: hand back one life and resume.
 *
 * Only ever called after an ad has actually reported completion — see
 * `src/ads/adManager.ts`, which never resolves a reward for a dismissed or
 * failed ad.
 */
export function restoreLife(state: SessionState): SessionState {
  return {
    ...state,
    lives: Math.min(MAX_LIVES, state.lives + 1),
    status: state.status === 'gameOver' ? 'playing' : state.status,
  };
}

/**
 * Rewarded-ad reward: continue after a game over *and* keep the streak that was
 * running when the last life was lost.
 */
export function continueWithStreak(state: SessionState, streak: number): SessionState {
  const resumed = restoreLife(state);
  return {
    ...resumed,
    streak,
    bestStreakInRun: Math.max(resumed.bestStreakInRun, streak),
  };
}

/** Rewarded-ad reward: mark the current puzzle's answer as revealed. */
export function revealAnswer(state: SessionState): SessionState {
  const puzzle = currentPuzzle(state);
  if (puzzle === null || state.revealedPuzzleIds.includes(puzzle.id)) return state;
  return { ...state, revealedPuzzleIds: [...state.revealedPuzzleIds, puzzle.id] };
}

export function isAnswerRevealed(state: SessionState): boolean {
  const puzzle = currentPuzzle(state);
  return puzzle !== null && state.revealedPuzzleIds.includes(puzzle.id);
}

/** Progress through a daily run, or null for endless. */
export function progress(state: SessionState): number | null {
  const limit = totalQuestions(state);
  if (limit === null) return null;
  return Math.min(1, state.index / limit);
}
