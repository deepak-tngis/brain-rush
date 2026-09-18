import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, elevation, radii, spacing } from '../theme/theme';

/**
 * Celebrates a streak.
 *
 * The burst is deliberately short and driven entirely on the native thread, so
 * it can never delay the next puzzle appearing — the feel of the game depends on
 * answer-to-answer latency far more than on the animation itself.
 */
export function StreakBurst({ streak, trigger }: { streak: number; trigger: number }): React.ReactElement | null {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    lift.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, speed: 20, bounciness: 14 }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.delay(620),
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
      Animated.timing(lift, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [trigger, scale, opacity, lift]);

  if (streak < 2) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.burst,
        elevation('high'),
        {
          opacity,
          transform: [
            { scale },
            { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) },
          ],
        },
      ]}
    >
      <Text style={styles.burstFlame}>{'⚡'}</Text>
      <Text style={styles.burstText}>{streak} in a row!</Text>
    </Animated.View>
  );
}

/** Floating "+10" that rises out of the score as it increases. */
export function ScorePop({ points, trigger }: { points: number; trigger: number }): React.ReactElement | null {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 850,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [trigger, progress]);

  if (points <= 0) return null;

  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.scorePop,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -34] }) },
          ],
        },
      ]}
    >
      +{points}
    </Animated.Text>
  );
}

/**
 * Wraps content and shakes it. Used on a wrong answer — brief enough to read as
 * feedback rather than as an interruption.
 */
export function ShakeView({
  trigger,
  children,
  style,
}: {
  trigger: number;
  children: React.ReactNode;
  style?: React.ComponentProps<typeof View>['style'];
}): React.ReactElement {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0) return;
    offset.setValue(0);
    Animated.sequence([
      Animated.timing(offset, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(offset, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(offset, { toValue: 0.6, duration: 55, useNativeDriver: true }),
      Animated.timing(offset, { toValue: -0.6, duration: 55, useNativeDriver: true }),
      Animated.timing(offset, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [trigger, offset]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            { translateX: offset.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Slow, continuous pulse used to draw the eye to the Play button.
 *
 * `active` exists for power: expo-router keeps Home mounted underneath the
 * board, so without it this loop would keep the animation driver ticking for
 * the entire time the player is doing something else.
 */
export function PulseView({
  children,
  active = true,
}: {
  children: React.ReactNode;
  active?: boolean;
}): React.ReactElement {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, active]);

  return (
    <Animated.View
      style={{
        transform: [
          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Slow vertical drift, used to keep the Home mark from sitting dead still.
 *
 * Stoppable for the same reason as {@link PulseView}: an idle loop on a screen
 * nobody is looking at is pure battery.
 */
export function FloatView({
  children,
  distance = 7,
  duration = 2400,
  active = true,
}: {
  children: React.ReactNode;
  distance?: number;
  duration?: number;
  active?: boolean;
}): React.ReactElement {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      drift.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, duration, active]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            translateY: drift.interpolate({
              inputRange: [0, 1],
              outputRange: [distance / 2, -distance / 2],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Fades and lifts its children in once, on mount.
 *
 * Home uses it with a stagger so the screen assembles itself as the intro
 * curtain lifts, rather than snapping in fully formed behind it.
 */
export function EnterView({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.ComponentProps<typeof View>['style'];
}): React.ReactElement {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(enter, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [enter, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  burst: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.pink,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  burstFlame: {
    fontSize: 22,
  },
  burstText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
  },
  scorePop: {
    position: 'absolute',
    top: -6,
    right: 0,
    color: colors.success,
    fontSize: 18,
    fontWeight: '900',
  },
});
