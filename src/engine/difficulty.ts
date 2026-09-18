import type { Difficulty } from './types';

/**
 * Difficulty ramps with the question index rather than with score, so the curve
 * is identical for every player and every run — including the daily challenge.
 */
export const EASY_QUESTION_COUNT = 5;
export const MEDIUM_QUESTION_COUNT = 7;
export const HARD_QUESTION_COUNT = 8;

/**
 * Share of a fixed-length run spent in each band. A ten-question daily would
 * otherwise never leave the medium band, because the open-ended curve above
 * only reaches "hard" at question 13.
 */
const FIXED_RUN_SHARES: ReadonlyArray<readonly [Difficulty, number]> = [
  ['easy', 0.3],
  ['medium', 0.4],
  ['hard', 0.3],
];

/**
 * @param total Length of a fixed-length run. When given, the bands are scaled
 *   to fit it; when omitted the run is open-ended and keeps climbing to expert.
 */
export function difficultyForIndex(index: number, total?: number): Difficulty {
  if (total !== undefined && total > 0) {
    let boundary = 0;
    for (const [band, share] of FIXED_RUN_SHARES) {
      boundary += Math.round(total * share);
      if (index < boundary) return band;
    }
    return 'hard';
  }
  if (index < EASY_QUESTION_COUNT) return 'easy';
  if (index < EASY_QUESTION_COUNT + MEDIUM_QUESTION_COUNT) return 'medium';
  if (index < EASY_QUESTION_COUNT + MEDIUM_QUESTION_COUNT + HARD_QUESTION_COUNT) return 'hard';
  return 'expert';
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
  expert: 6500,
};

/**
 * From the hard band onwards the window keeps tightening, bottoming out at 5s
 * so the game stays fast without becoming impossible.
 */
const HARD_FLOOR_MS = 5000;
const HARD_STEP_MS = 250;

export function timeLimitForIndex(index: number, scale = 1, total?: number): number {
  const difficulty = difficultyForIndex(index, total);
  let limit = BASE_TIME_LIMIT_MS[difficulty];
  if (total === undefined && (difficulty === 'hard' || difficulty === 'expert')) {
    const stepsIntoHard = index - (EASY_QUESTION_COUNT + MEDIUM_QUESTION_COUNT);
    limit = Math.max(HARD_FLOOR_MS, limit - stepsIntoHard * HARD_STEP_MS);
  }
  return Math.round(limit * scale);
}

export function baseTimeLimit(difficulty: Difficulty, scale = 1): number {
  return Math.round(BASE_TIME_LIMIT_MS[difficulty] * scale);
}

/** How many answer options a puzzle offers at a given difficulty. */
export function optionCountFor(
  difficulty: Difficulty,
  easy = 4,
  medium = 4,
  hard = 6,
  expert = hard,
): number {
  if (difficulty === 'easy') return easy;
  if (difficulty === 'medium') return medium;
  if (difficulty === 'hard') return hard;
  return expert;
}

/** True for the hard and expert bands, which most generators treat alike. */
export function isHardOrAbove(difficulty: Difficulty): boolean {
  return difficulty === 'hard' || difficulty === 'expert';
}
