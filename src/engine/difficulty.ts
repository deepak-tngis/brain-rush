import type { Difficulty } from './types';

/**
 * Difficulty ramps with the question index rather than with score, so the curve
 * is identical for every player and every run — including the daily challenge.
 */
export const EASY_QUESTION_COUNT = 5;
export const MEDIUM_QUESTION_COUNT = 7;

export function difficultyForIndex(index: number): Difficulty {
  if (index < EASY_QUESTION_COUNT) return 'easy';
  if (index < EASY_QUESTION_COUNT + MEDIUM_QUESTION_COUNT) return 'medium';
  return 'hard';
}

/**
 * Base decision window per difficulty. Generators may shorten this further for
 * puzzles that are quick to read (e.g. two-term maths) or lengthen it for ones
 * that need scanning (e.g. counting twenty objects).
 */
const BASE_TIME_LIMIT_MS: Record<Difficulty, number> = {
  easy: 15000,
  medium: 11000,
  hard: 7500,
};

/**
 * Within the hard band the window keeps tightening, bottoming out at 5s so the
 * game stays fast without becoming impossible.
 */
const HARD_FLOOR_MS = 5000;
const HARD_STEP_MS = 250;

export function timeLimitForIndex(index: number, scale = 1): number {
  const difficulty = difficultyForIndex(index);
  let limit = BASE_TIME_LIMIT_MS[difficulty];
  if (difficulty === 'hard') {
    const stepsIntoHard = index - (EASY_QUESTION_COUNT + MEDIUM_QUESTION_COUNT);
    limit = Math.max(HARD_FLOOR_MS, limit - stepsIntoHard * HARD_STEP_MS);
  }
  return Math.round(limit * scale);
}

export function baseTimeLimit(difficulty: Difficulty, scale = 1): number {
  return Math.round(BASE_TIME_LIMIT_MS[difficulty] * scale);
}

/** How many answer options a puzzle offers at a given difficulty. */
export function optionCountFor(difficulty: Difficulty, easy = 4, medium = 4, hard = 6): number {
  if (difficulty === 'easy') return easy;
  if (difficulty === 'medium') return medium;
  return hard;
}
