import { useCallback, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { haptic } from '../audio/haptics';
import { playSound } from '../audio/soundManager';
import { useTapGuard } from '../hooks/useTapGuard';

export interface PressableScaleProps {
  readonly children: React.ReactNode;
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly disabled?: boolean;
  /** Silence the tap click for controls that play their own sound. */
  readonly silent?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityRole?: 'button' | 'radio';
  readonly accessibilityState?: { selected?: boolean; disabled?: boolean };
  readonly pressedScale?: number;
}

/**
 * The app's one interactive primitive: a press target that dips under the
 * finger, clicks, and cannot be double-fired.
 */
export function PressableScale({
  children,
  onPress,
  style,
  disabled = false,
  silent = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  pressedScale = 0.96,
}: PressableScaleProps): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;
  const guard = useTapGuard();

  const animateTo = useCallback(
    (value: number) => {
      Animated.spring(scale, {
        toValue: value,
        useNativeDriver: true,
        speed: 40,
        bounciness: 6,
      }).start();
    },
    [scale],
  );

  const handlePress = useCallback(() => {
    guard(() => {
      if (!silent) playSound('tap');
      haptic('light');
      onPress();
    });
  }, [guard, onPress, silent]);

  return (
    <Pressable
      onPressIn={() => animateTo(pressedScale)}
      onPressOut={() => animateTo(1)}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={styles.pressable}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && styles.disabled]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    // The animated child owns all visual styling; this wrapper is layout-neutral.
  },
  disabled: {
    opacity: 0.45,
  },
});
