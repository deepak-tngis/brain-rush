/**
 * AdMob integration.
 *
 * Two rules govern everything in this file:
 *
 *   1. Gameplay is never blocked. Every entry point resolves within a bounded
 *      time whether or not the SDK is present, the device is online, or an ad
 *      fills. The caller always gets an answer it can act on.
 *   2. A reward is only ever granted after the SDK reports the user actually
 *      earned it. A dismissed, failed or timed-out rewarded ad grants nothing.
 */
import { adConfig } from './adConfig';
import { createPolicyState, registerShown, registerTrigger } from './interstitialPolicy';
import type { InterstitialPolicyState } from './interstitialPolicy';

/** How long to wait for an ad to load before giving up and letting play continue. */
const LOAD_TIMEOUT_MS = 8000;

export type RewardKind = 'restore-life' | 'reveal-answer' | 'continue-run';

export type RewardOutcome =
  | { readonly granted: true }
  | { readonly granted: false; readonly reason: 'unavailable' | 'dismissed' | 'error' };

type Unsubscribe = () => void;

interface AdUnit {
  load(): void;
  show(): Promise<unknown> | void;
  addAdEventListener(type: unknown, listener: (payload?: unknown) => void): Unsubscribe;
  readonly loaded?: boolean;
}

interface MobileAdsModule {
  default: () => {
    initialize(): Promise<unknown>;
    setRequestConfiguration(config: Record<string, unknown>): Promise<unknown>;
  };
  InterstitialAd: { createForAdRequest(unitId: string, options?: Record<string, unknown>): AdUnit };
  RewardedAd: { createForAdRequest(unitId: string, options?: Record<string, unknown>): AdUnit };
  AdEventType: Record<string, unknown>;
  RewardedAdEventType: Record<string, unknown>;
  MaxAdContentRating: Record<string, string>;
}

let sdk: MobileAdsModule | null | undefined;

/**
 * Resolves the ad SDK once.
 *
 * Expo Go and any build without the native module return null here, which turns
 * every ad entry point into an immediate, harmless no-op rather than a crash.
 */
function resolveSdk(): MobileAdsModule | null {
  if (sdk !== undefined) return sdk;
  try {
    sdk = require('react-native-google-mobile-ads') as MobileAdsModule;
  } catch {
    sdk = null;
  }
  return sdk;
}

let initialised: Promise<boolean> | null = null;
let personalisedAds = false;
let policy: InterstitialPolicyState = createPolicyState();

export function setPersonalisedAds(value: boolean): void {
  personalisedAds = value;
}

export function adsAvailable(): boolean {
  return resolveSdk() !== null;
}

/**
 * Starts the SDK. Resolves false (rather than rejecting) when ads are simply not
 * available — offline, missing module, or an initialisation failure.
 */
export function initAds(): Promise<boolean> {
  if (initialised !== null) return initialised;

  initialised = (async () => {
    const module = resolveSdk();
    if (module === null) return false;
    try {
      await module.default().setRequestConfiguration({
        maxAdContentRating: module.MaxAdContentRating.PG,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
      await module.default().initialize();
      return true;
    } catch {
      return false;
    }
  })();

  return initialised;
}

function requestOptions(): Record<string, unknown> {
  return { requestNonPersonalizedAdsOnly: !personalisedAds };
}

/**
 * Loads an ad unit and resolves once it is ready.
 *
 * Resolves null on error or after the timeout — never rejects, and never leaves
 * a listener attached.
 */
function loadUnit(unit: AdUnit, module: MobileAdsModule): Promise<AdUnit | null> {
  return new Promise((resolve) => {
    let settled = false;
    const cleanups: Unsubscribe[] = [];

    const finish = (value: AdUnit | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch {
          // A listener that is already gone is not a problem.
        }
      }
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), LOAD_TIMEOUT_MS);

    try {
      cleanups.push(unit.addAdEventListener(module.AdEventType.LOADED, () => finish(unit)));
      cleanups.push(
        unit.addAdEventListener(module.RewardedAdEventType.LOADED, () => finish(unit)),
      );
      cleanups.push(unit.addAdEventListener(module.AdEventType.ERROR, () => finish(null)));
      unit.load();
    } catch {
      finish(null);
    }
  });
}

/**
 * Offers an interstitial for an eligible trigger.
 *
 * Returns whether one was shown. The frequency rules are applied *before* the ad
 * is requested, and the counter only resets when an ad actually opens, so failed
 * fills never consume the player's allowance.
 */
export async function maybeShowInterstitial(options: {
  puzzleActive: boolean;
  /** Injectable clock. When supplied it is used for the cooldown stamp too, so
   *  the decision and the record can never be read off two different clocks. */
  now?: number;
}): Promise<boolean> {
  const injectedNow = options.now;
  const now = injectedNow ?? Date.now();
  const decision = registerTrigger(policy, { puzzleActive: options.puzzleActive, now });
  policy = decision.state;
  if (!decision.show) return false;

  const module = resolveSdk();
  if (module === null) return false;
  if (!(await initAds())) return false;

  try {
    const unit = module.InterstitialAd.createForAdRequest(
      adConfig.interstitialId,
      requestOptions(),
    );
    const loaded = await loadUnit(unit, module);
    if (loaded === null) return false;

    return await new Promise<boolean>((resolve) => {
      let opened = false;
      const cleanups: Unsubscribe[] = [];
      const done = (shown: boolean): void => {
        for (const cleanup of cleanups) {
          try {
            cleanup();
          } catch {
            // Already detached.
          }
        }
        resolve(shown);
      };

      try {
        cleanups.push(
          loaded.addAdEventListener(module.AdEventType.OPENED, () => {
            opened = true;
            // Stamped when the ad actually opened, not when it was requested.
            policy = registerShown(injectedNow ?? Date.now());
          }),
        );
        cleanups.push(loaded.addAdEventListener(module.AdEventType.CLOSED, () => done(opened)));
        cleanups.push(loaded.addAdEventListener(module.AdEventType.ERROR, () => done(false)));
        void Promise.resolve(loaded.show()).catch(() => done(false));
      } catch {
        done(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Shows a rewarded ad and reports whether the reward was earned.
 *
 * `granted: true` is returned only when the SDK fires EARNED_REWARD. Closing the
 * ad early, an ad that never loads, and an offline device all resolve to
 * `granted: false` with a reason the UI can explain.
 */
export async function showRewardedAd(kind: RewardKind): Promise<RewardOutcome> {
  void kind;
  const module = resolveSdk();
  if (module === null) return { granted: false, reason: 'unavailable' };
  if (!(await initAds())) return { granted: false, reason: 'unavailable' };

  try {
    const unit = module.RewardedAd.createForAdRequest(adConfig.rewardedId, requestOptions());
    const loaded = await loadUnit(unit, module);
    if (loaded === null) return { granted: false, reason: 'unavailable' };

    return await new Promise<RewardOutcome>((resolve) => {
      let earned = false;
      const cleanups: Unsubscribe[] = [];
      const done = (outcome: RewardOutcome): void => {
        for (const cleanup of cleanups) {
          try {
            cleanup();
          } catch {
            // Already detached.
          }
        }
        resolve(outcome);
      };

      try {
        cleanups.push(
          loaded.addAdEventListener(module.RewardedAdEventType.EARNED_REWARD, () => {
            earned = true;
          }),
        );
        cleanups.push(
          loaded.addAdEventListener(module.AdEventType.CLOSED, () =>
            done(earned ? { granted: true } : { granted: false, reason: 'dismissed' }),
          ),
        );
        cleanups.push(
          loaded.addAdEventListener(module.AdEventType.ERROR, () =>
            done({ granted: false, reason: 'error' }),
          ),
        );
        void Promise.resolve(loaded.show()).catch(() =>
          done({ granted: false, reason: 'error' }),
        );
      } catch {
        done({ granted: false, reason: 'error' });
      }
    });
  } catch {
    return { granted: false, reason: 'error' };
  }
}

/** Test seam: lets the policy be inspected and reset without the SDK. */
export function __policyForTests(): InterstitialPolicyState {
  return policy;
}

export function __resetPolicyForTests(): void {
  policy = createPolicyState();
}
