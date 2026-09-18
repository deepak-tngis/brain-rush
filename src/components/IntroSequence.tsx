import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { BrainLogo } from './BrainLogo';
import { colors, gradients, radii, spacing, typography } from '../theme/theme';

/**
 * How long the sequence runs before it hands over to Home, in milliseconds.
 *
 * Short on purpose. An intro is worth watching once; after that it is a toll on
 * every launch, and this one is in front of a game people open to fill a spare
 * minute. Long enough for the mark to land and the wordmark to settle, and no
 * longer.
 */
const RUN_MS = 1250;
const FADE_OUT_MS = 240;

/**
 * The launch animation.
 *
 * The native splash is a single static image and cannot animate, so it is held
 * up only until the save file has loaded and then hands over to this: the mark
 * springs in, the wordmark lands under it, and a meter fills while the rest of
 * the app mounts behind the curtain. That last part is the point — the sequence
 * is covering real startup work rather than being a delay bolted onto the front
 * of it, so it costs the player nothing to watch.
 *
 * Every animation runs on the native driver, so a slow first render of Home
 * cannot make the intro stutter.
 */
export function IntroSequence({ onDone }: { onDone: () => void }): React.ReactElement {
  const mark = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const meter = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(1)).current;
  const halo = useRef(new Animated.Value(0)).current;

  // `onDone` is read through a ref so a caller that passes a fresh closure on
  // every render cannot restart the sequence half way through.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const sequence = Animated.parallel([
      Animated.spring(mark, {
        toValue: 1,
        useNativeDriver: true,
        speed: 9,
        bounciness: 9,
      }),
      Animated.sequence([
        Animated.delay(190),
        Animated.spring(word, { toValue: 1, useNativeDriver: true, speed: 13, bounciness: 6 }),
      ]),
      Animated.sequence([
        Animated.delay(380),
        Animated.timing(tagline, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]),
      Animated.timing(meter, {
        toValue: 1,
        duration: RUN_MS - 120,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.quad),
      }),
      Animated.sequence([
        Animated.delay(RUN_MS),
        Animated.timing(curtain, {
          toValue: 0,
          duration: FADE_OUT_MS,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }),
      ]),
    ]);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ]),
    );

    pulse.start();
    sequence.start(({ finished }) => {
      if (finished) done.current();
    });

    return () => {
      pulse.stop();
      sequence.stop();
    };
  }, [mark, word, tagline, meter, curtain, halo]);

  return (
    <Animated.View style={[styles.root, { opacity: curtain }]} pointerEvents="none">
      <LinearGradient
        colors={[...gradients.brand]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.centre}>
        <View style={styles.markWrap}>
          {/* Soft ring breathing behind the mark, so the hold before the
              wordmark arrives never looks like a frozen frame. */}
          <Animated.View
            style={[
              styles.halo,
              {
                opacity: Animated.multiply(
                  mark,
                  halo.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.4] }),
                ),
                transform: [
                  { scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) },
                ],
              },
            ]}
          />
          <Animated.View
            style={{
              opacity: mark,
              transform: [
                { scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) },
                {
                  rotate: mark.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-16deg', '0deg'],
                  }),
                },
              ],
            }}
          >
            <View style={styles.disc}>
              <BrainLogo size={104} />
            </View>
          </Animated.View>
        </View>

        <Animated.View
          style={{
            opacity: word,
            transform: [
              { translateY: word.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
            ],
          }}
        >
          <Text style={styles.wordmark}>BRAIN RUSH</Text>
        </Animated.View>

        <Animated.Text style={[styles.tagline, { opacity: tagline }]}>
          Think fast. Score faster.
        </Animated.Text>
      </View>

      <View style={styles.meterTrack}>
        <Animated.View
          style={[
            styles.meterFill,
            {
              // Scaled rather than width-animated: transforms stay on the
              // native thread, widths do not.
              transform: [
                { scaleX: meter.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] }) },
              ],
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: gradients.brand[0],
  },
  centre: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  halo: {
    position: 'absolute',
    width: 208,
    height: 208,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
  },
  disc: {
    width: 152,
    height: 152,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    ...typography.display,
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
  },
  tagline: {
    ...typography.body,
    color: colors.white,
    opacity: 0.85,
    letterSpacing: 0.4,
  },
  meterTrack: {
    position: 'absolute',
    bottom: 72,
    width: 132,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  meterFill: {
    width: '100%',
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    // scaleX pivots on the centre unless told otherwise; the meter has to grow
    // from the leading edge to read as filling rather than as expanding.
    transformOrigin: 'left',
  },
});
