import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/**
 * Handles Android's hardware/gesture back button.
 *
 * `handler` returns true when it has dealt with the press (so the OS should not
 * pop the screen or exit the app) and false to let the default happen. The
 * subscription is only active while `enabled` is true, so a screen can hand back
 * control — for example once a confirmation dialog has been dismissed.
 */
export function useAndroidBack(handler: () => boolean, enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => subscription.remove();
  }, [handler, enabled]);
}
