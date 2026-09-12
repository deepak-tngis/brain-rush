/**
 * Haptics, behind the same "never break gameplay" contract as audio: the module
 * is resolved defensively and every call swallows its own failure.
 */
import { Platform } from 'react-native';

type FeedbackKind = 'light' | 'medium' | 'success' | 'warning';

interface HapticsModule {
  impactAsync(style: unknown): Promise<unknown>;
  notificationAsync(type: unknown): Promise<unknown>;
  ImpactFeedbackStyle: { Light: unknown; Medium: unknown };
  NotificationFeedbackType: { Success: unknown; Warning: unknown };
}

let cached: HapticsModule | null | undefined;

function resolveHaptics(): HapticsModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('expo-haptics') as HapticsModule;
  } catch {
    cached = null;
  }
  return cached;
}

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function haptic(kind: FeedbackKind): void {
  if (!enabled || Platform.OS === 'web') return;
  const module = resolveHaptics();
  if (module === null) return;

  try {
    switch (kind) {
      case 'light':
        void module.impactAsync(module.ImpactFeedbackStyle.Light).catch(() => undefined);
        break;
      case 'medium':
        void module.impactAsync(module.ImpactFeedbackStyle.Medium).catch(() => undefined);
        break;
      case 'success':
        void module.notificationAsync(module.NotificationFeedbackType.Success).catch(() => undefined);
        break;
      case 'warning':
        void module.notificationAsync(module.NotificationFeedbackType.Warning).catch(() => undefined);
        break;
      default:
        break;
    }
  } catch {
    // Device without a vibrator, or a permission quirk: silently do nothing.
  }
}
