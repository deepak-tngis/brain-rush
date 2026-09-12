import type { RewardOutcome } from '../ads/adManager';

/**
 * Rewarded and interstitial ads, driven against a controllable fake SDK.
 *
 * The acceptance criterion is narrow and important: a reward is granted *only*
 * after an advert genuinely completes. These tests drive the fake through every
 * way an advert can end — earned, dismissed early, failed, never filled — and
 * assert the manager's verdict each time. The interstitial cases check the same
 * property from the other side: the frequency allowance must only be spent by an
 * advert that actually reached the screen.
 *
 * Names are `mock`-prefixed because Jest hoists `jest.mock` above the file.
 */

type MockListener = (payload?: unknown) => void;

/** How the fake ad unit behaves for the test that is running. */
interface MockScenario {
  loads: boolean;
  onShow: 'earn-then-close' | 'close-only' | 'error' | 'open-then-close';
}

const mockScenario: MockScenario = { loads: true, onShow: 'earn-then-close' };

const mockAdEvents = {
  LOADED: 'loaded',
  ERROR: 'error',
  OPENED: 'opened',
  CLOSED: 'closed',
} as const;

const mockRewardedEvents = {
  LOADED: 'rewarded_loaded',
  EARNED_REWARD: 'earned',
} as const;

function mockCreateUnit(): unknown {
  const listeners = new Map<string, Set<MockListener>>();

  const emit = (type: string): void => {
    for (const listener of listeners.get(type) ?? []) listener();
  };

  return {
    addAdEventListener(type: string, listener: MockListener) {
      const bucket = listeners.get(type) ?? new Set<MockListener>();
      bucket.add(listener);
      listeners.set(type, bucket);
      return () => bucket.delete(listener);
    },
    load() {
      // Asynchronous, like the real SDK.
      setTimeout(() => emit(mockScenario.loads ? mockAdEvents.LOADED : mockAdEvents.ERROR), 0);
    },
    show() {
      setTimeout(() => {
        if (mockScenario.onShow === 'error') {
          emit(mockAdEvents.ERROR);
          return;
        }
        emit(mockAdEvents.OPENED);
        if (mockScenario.onShow === 'earn-then-close') emit(mockRewardedEvents.EARNED_REWARD);
        emit(mockAdEvents.CLOSED);
      }, 0);
    },
  };
}

jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({
    initialize: () => Promise.resolve(),
    setRequestConfiguration: () => Promise.resolve(),
  }),
  RewardedAd: { createForAdRequest: () => mockCreateUnit() },
  InterstitialAd: { createForAdRequest: () => mockCreateUnit() },
  AdEventType: mockAdEvents,
  RewardedAdEventType: mockRewardedEvents,
  MaxAdContentRating: { PG: 'PG' },
}));

/** A fresh manager per test, since it caches the SDK and its policy state. */
function loadManager(): typeof import('../ads/adManager') {
  let manager: typeof import('../ads/adManager') | undefined;
  jest.isolateModules(() => {
    manager = require('../ads/adManager') as typeof import('../ads/adManager');
  });
  return manager as typeof import('../ads/adManager');
}

beforeEach(() => {
  mockScenario.loads = true;
  mockScenario.onShow = 'earn-then-close';
});

describe('rewarded adverts', () => {
  it('grants the reward when the advert reports it was earned', async () => {
    const outcome: RewardOutcome = await loadManager().showRewardedAd('restore-life');
    expect(outcome).toEqual({ granted: true });
  });

  it('grants nothing when the advert is closed early', async () => {
    mockScenario.onShow = 'close-only';
    const outcome = await loadManager().showRewardedAd('reveal-answer');
    expect(outcome).toEqual({ granted: false, reason: 'dismissed' });
  });

  it('grants nothing when the advert errors while showing', async () => {
    mockScenario.onShow = 'error';
    const outcome = await loadManager().showRewardedAd('continue-run');
    expect(outcome).toEqual({ granted: false, reason: 'error' });
  });

  it('grants nothing when no advert can be loaded at all', async () => {
    mockScenario.loads = false;
    const outcome = await loadManager().showRewardedAd('restore-life');
    expect(outcome).toEqual({ granted: false, reason: 'unavailable' });
  });
});

describe('interstitials', () => {
  it('shows on the third eligible trigger and not before', async () => {
    mockScenario.onShow = 'open-then-close';
    const manager = loadManager();

    expect(await manager.maybeShowInterstitial({ puzzleActive: false, now: 0 })).toBe(false);
    expect(await manager.maybeShowInterstitial({ puzzleActive: false, now: 1_000 })).toBe(false);
    expect(await manager.maybeShowInterstitial({ puzzleActive: false, now: 2_000 })).toBe(true);
  });

  it('never shows while a puzzle is on screen', async () => {
    const manager = loadManager();
    for (let i = 0; i < 10; i += 1) {
      expect(await manager.maybeShowInterstitial({ puzzleActive: true, now: i * 1_000 })).toBe(false);
    }
  });

  it('does not spend the allowance when the advert fails to load', async () => {
    mockScenario.loads = false;
    const manager = loadManager();

    for (let i = 0; i < 3; i += 1) {
      expect(await manager.maybeShowInterstitial({ puzzleActive: false, now: i })).toBe(false);
    }

    // The third trigger was eligible but nothing was served, so the counter was
    // never reset: the very next trigger gets its chance.
    mockScenario.loads = true;
    mockScenario.onShow = 'open-then-close';
    expect(await manager.maybeShowInterstitial({ puzzleActive: false, now: 5_000 })).toBe(true);
  });

  it('keeps a minute between interstitials', async () => {
    mockScenario.onShow = 'open-then-close';
    const manager = loadManager();

    await manager.maybeShowInterstitial({ puzzleActive: false, now: 0 });
    await manager.maybeShowInterstitial({ puzzleActive: false, now: 0 });
    expect(await manager.maybeShowInterstitial({ puzzleActive: false, now: 0 })).toBe(true);

    // Three more eligible triggers, all inside the cooldown.
    for (let i = 0; i < 3; i += 1) {
      expect(await manager.maybeShowInterstitial({ puzzleActive: false, now: 1_000 * i })).toBe(false);
    }

    // Once the minute has passed, the waiting triggers are honoured.
    expect(await manager.maybeShowInterstitial({ puzzleActive: false, now: 61_000 })).toBe(true);
  });
});
