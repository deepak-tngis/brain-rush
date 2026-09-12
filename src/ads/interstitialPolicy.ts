/**
 * When an interstitial is allowed to appear.
 *
 * Kept as pure data so the frequency rules can be unit-tested without loading
 * the ad SDK, and so the answer never depends on whether an ad happened to fill.
 */

/** Show at most one interstitial per this many eligible triggers. */
export const TRIGGERS_PER_INTERSTITIAL = 3;

/** Never show two interstitials closer together than this. */
export const MIN_INTERSTITIAL_GAP_MS = 60_000;

export interface InterstitialPolicyState {
  /** Eligible triggers accumulated since the last interstitial was shown. */
  readonly triggersSinceLastAd: number;
  /** Timestamp of the last shown interstitial, or null if none this session. */
  readonly lastShownAt: number | null;
}

export function createPolicyState(): InterstitialPolicyState {
  return { triggersSinceLastAd: 0, lastShownAt: null };
}

export interface TriggerContext {
  /** A puzzle on screen is never interrupted, so it is not even a trigger. */
  readonly puzzleActive: boolean;
  readonly now: number;
}

export interface TriggerDecision {
  readonly show: boolean;
  readonly state: InterstitialPolicyState;
  readonly reason: 'shown' | 'puzzle-active' | 'too-soon' | 'not-enough-triggers';
}

/**
 * Records an eligible trigger and decides whether to show.
 *
 * The trigger counter only resets when an ad is actually shown, so a trigger
 * suppressed by the 60-second floor is not wasted — the very next one shows.
 */
export function registerTrigger(
  state: InterstitialPolicyState,
  context: TriggerContext,
): TriggerDecision {
  if (context.puzzleActive) {
    return { show: false, state, reason: 'puzzle-active' };
  }

  const triggersSinceLastAd = state.triggersSinceLastAd + 1;
  const pending: InterstitialPolicyState = { ...state, triggersSinceLastAd };

  if (triggersSinceLastAd < TRIGGERS_PER_INTERSTITIAL) {
    return { show: false, state: pending, reason: 'not-enough-triggers' };
  }

  const elapsed = state.lastShownAt === null ? Number.POSITIVE_INFINITY : context.now - state.lastShownAt;
  if (elapsed < MIN_INTERSTITIAL_GAP_MS) {
    return { show: false, state: pending, reason: 'too-soon' };
  }

  return { show: true, state: pending, reason: 'shown' };
}

/**
 * Confirms an interstitial actually reached the screen.
 *
 * Called only after the SDK reports the ad opened — an ad that failed to load or
 * to fill leaves the counter alone, so a run of empty inventory does not quietly
 * eat the player's next three eligible triggers.
 */
export function registerShown(now: number): InterstitialPolicyState {
  return { triggersSinceLastAd: 0, lastShownAt: now };
}
