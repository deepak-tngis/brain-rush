import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { setHapticsEnabled } from '../audio/haptics';
import { initSounds, setSoundEnabled } from '../audio/soundManager';
import { setPersonalisedAds } from '../ads/adManager';
import {
  flush,
  getProgress,
  hydrate,
  isHydrated,
  subscribe,
  updateSettings,
} from '../storage/progressStore';
import type { ProgressState, Settings } from '../storage/schema';

/**
 * Binds the progress store to React.
 *
 * The store itself is a plain module so the game logic can use it without a
 * React tree; this hook is only the subscription. `useSyncExternalStore` keeps
 * every screen consistent without a context re-render cascade.
 */
export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}

export function useSettings(): Settings {
  return useProgress().settings;
}

/** Changes one setting. A plain function: no hook, no provider, no re-render fan-out. */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  updateSettings({ [key]: value } as Partial<Settings>);
}

export interface ProgressBootstrap {
  readonly ready: boolean;
  readonly progress: ProgressState;
}

/**
 * One-time app bootstrap: load the save, start the sound engine, and keep the
 * audio/haptics/ads switches in sync with the player's settings.
 */
export function useProgressBootstrap(): ProgressBootstrap {
  const [ready, setReady] = useState(isHydrated());
  const progress = useProgress();

  useEffect(() => {
    let cancelled = false;
    void hydrate().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Settings are the source of truth; the side-effecting modules follow them.
  useEffect(() => {
    setSoundEnabled(progress.settings.soundEnabled);
    setHapticsEnabled(progress.settings.hapticsEnabled);
    setPersonalisedAds(progress.settings.personalisedAds);
  }, [
    progress.settings.soundEnabled,
    progress.settings.hapticsEnabled,
    progress.settings.personalisedAds,
  ]);

  useEffect(() => {
    if (!ready || !progress.settings.soundEnabled) return;
    void initSounds();
  }, [ready, progress.settings.soundEnabled]);

  // A backgrounded app may never come back, so commit any pending write now.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void flush();
    });
    return () => subscription.remove();
  }, []);

  return useMemo(() => ({ ready, progress }), [ready, progress]);
}
