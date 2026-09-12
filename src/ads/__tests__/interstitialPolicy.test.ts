import {
  createPolicyState,
  MIN_INTERSTITIAL_GAP_MS,
  registerShown,
  registerTrigger,
  TRIGGERS_PER_INTERSTITIAL,
} from '../interstitialPolicy';
import type { InterstitialPolicyState } from '../interstitialPolicy';

function trigger(
  state: InterstitialPolicyState,
  now: number,
  puzzleActive = false,
): ReturnType<typeof registerTrigger> {
  return registerTrigger(state, { now, puzzleActive });
}

describe('interstitial frequency rules', () => {
  it('shows on the third eligible trigger, not before', () => {
    let state = createPolicyState();
    for (let i = 1; i < TRIGGERS_PER_INTERSTITIAL; i += 1) {
      const decision = trigger(state, i * 1000);
      expect(decision.show).toBe(false);
      state = decision.state;
    }
    expect(trigger(state, 10_000).show).toBe(true);
  });

  it('never shows while a puzzle is on screen, and does not count the trigger', () => {
    let state = createPolicyState();
    for (let i = 0; i < 10; i += 1) {
      const decision = trigger(state, i * 1000, true);
      expect(decision.show).toBe(false);
      expect(decision.reason).toBe('puzzle-active');
      state = decision.state;
    }
    expect(state.triggersSinceLastAd).toBe(0);
  });

  it('keeps at least a minute between interstitials', () => {
    let state = createPolicyState();
    for (let i = 0; i < TRIGGERS_PER_INTERSTITIAL; i += 1) state = trigger(state, 0).state;
    state = registerShown(0);

    let decision = trigger(state, 1_000);
    for (let i = 1; i < TRIGGERS_PER_INTERSTITIAL; i += 1) {
      decision = trigger(decision.state, 1_000 + i * 1_000);
    }
    expect(decision.show).toBe(false);
    expect(decision.reason).toBe('too-soon');
  });

  it('shows again on the next trigger once the cooldown has passed', () => {
    let state = registerShown(0);
    for (let i = 0; i < TRIGGERS_PER_INTERSTITIAL; i += 1) {
      state = trigger(state, 1_000 + i).state;
    }
    // Suppressed by the cooldown, but the accumulated triggers are not lost.
    expect(trigger(state, MIN_INTERSTITIAL_GAP_MS + 1).show).toBe(true);
  });

  it('does not consume the allowance when no ad was actually shown', () => {
    let state = createPolicyState();
    for (let i = 0; i < TRIGGERS_PER_INTERSTITIAL; i += 1) state = trigger(state, i).state;
    // The ad failed to fill, so registerShown is never called.
    expect(state.triggersSinceLastAd).toBe(TRIGGERS_PER_INTERSTITIAL);
    expect(trigger(state, 5_000).show).toBe(true);
  });

  it('resets the counter only when an ad reaches the screen', () => {
    expect(registerShown(1234)).toEqual({ triggersSinceLastAd: 0, lastShownAt: 1234 });
  });
});
