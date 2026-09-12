/**
 * Every number the game awards, in one place.
 *
 * Keeping the economy here (rather than sprinkled through screens) is what lets
 * the session reducer be unit-testable and the UI be a pure projection of it.
 */
export const POINTS_PER_CORRECT = 10;
export const COINS_PER_CORRECT = 5;
export const COINS_DAILY_COMPLETION = 50;
export const COINS_STREAK_5 = 20;
export const COINS_STREAK_10 = 50;
export const STARTING_COINS = 300;
export const STARTING_LIVES = 3;
export const MAX_LIVES = 5;

/**
 * Coins awarded for reaching `streak` consecutive correct answers.
 *
 * Every 10th answer pays the large bonus, every other 5th pays the small one, so
 * a long streak keeps paying out instead of rewarding only the first ten.
 */
export function streakBonusCoins(streak: number): number {
  if (streak <= 0) return 0;
  if (streak % 10 === 0) return COINS_STREAK_10;
  if (streak % 5 === 0) return COINS_STREAK_5;
  return 0;
}

/**
 * Answering fast is worth more, but never so much that a slow correct answer
 * feels wasted: the bonus tops out at half of the base award.
 */
export function speedBonusPoints(elapsedMs: number, timeLimitMs: number): number {
  if (timeLimitMs <= 0) return 0;
  const remaining = Math.max(0, timeLimitMs - elapsedMs) / timeLimitMs;
  return Math.round(POINTS_PER_CORRECT * 0.5 * remaining);
}
