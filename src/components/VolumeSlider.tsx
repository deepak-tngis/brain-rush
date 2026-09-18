import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { haptic } from '../audio/haptics';
import { colors, elevation, radii, spacing, typography } from '../theme/theme';

/**
 * A plain 0..1 slider.
 *
 * Written by hand rather than pulled from a package: the only thing this screen
 * needs is one horizontal track, and a native slider dependency would mean
 * another module in the build — and another rebuild — for a control that is
 * forty lines of `PanResponder`.
 *
 * The gesture is tracked against the track's measured width, so a drag that
 * leaves the control still maps sensibly instead of sticking.
 */
export function VolumeSlider({
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}): React.ReactElement {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const lastStep = useRef(-1);
  /** Where in the track the current drag began, in track-local pixels. */
  const grabX = useRef(0);
  onChangeRef.current = onChange;
  disabledRef.current = disabled;

  const clamped = Math.max(0, Math.min(1, value));

  const commit = useCallback((x: number) => {
    if (disabledRef.current) return;
    const track = widthRef.current;
    if (track <= 0) return;
    const next = Math.max(0, Math.min(1, x / track));
    // Ticking on each 5% keeps the haptic from firing on every pixel.
    const step = Math.round(next * 20);
    if (step !== lastStep.current) {
      lastStep.current = step;
      haptic('light');
    }
    onChangeRef.current(next);
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        // Claim the gesture so the surrounding ScrollView cannot steal a drag
        // that starts as a horizontal scrub.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          grabX.current = event.nativeEvent.locationX;
          commit(grabX.current);
        },
        // `locationX` is relative to whatever the touch is currently over, so it
        // jumps once the finger crosses the thumb. Anchor on where the drag
        // started and add the gesture's own delta, which stays in track space.
        onPanResponderMove: (_event, gesture) => commit(grabX.current + gesture.dx),
        onPanResponderRelease: () => {
          lastStep.current = -1;
        },
      }),
    [commit],
  );

  const percent = Math.round(clamped * 100);

  return (
    <View style={styles.root}>
      <View
        style={styles.hit}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          widthRef.current = next;
          setWidth(next);
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        accessibilityState={{ disabled }}
        {...responder.panHandlers}
      >
        <View style={[styles.track, disabled && styles.trackDisabled]}>
          <View
            style={[
              styles.fill,
              { width: `${percent}%` },
              disabled && styles.fillDisabled,
            ]}
          />
        </View>
        {width > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              elevation('low'),
              disabled && styles.thumbDisabled,
              { left: Math.max(0, Math.min(width - THUMB, clamped * width - THUMB / 2)) },
            ]}
          />
        ) : null}
      </View>
      <Text style={[styles.readout, disabled && styles.readoutDisabled]}>{percent}%</Text>
    </View>
  );
}

const THUMB = 22;

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hit: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  trackDisabled: {
    opacity: 0.5,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  fillDisabled: {
    backgroundColor: colors.textFaint,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  thumbDisabled: {
    borderColor: colors.textFaint,
  },
  readout: {
    ...typography.label,
    color: colors.textMuted,
    // Fixed width and lining figures, so the number does not shove the track
    // sideways as it moves between 9%, 90% and 100%.
    minWidth: 42,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  readoutDisabled: {
    color: colors.textFaint,
  },
});
