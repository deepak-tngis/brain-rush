import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { OptionContentView } from './OptionContent';
import type { PuzzleOption } from '../engine';
import { colors, elevation, radii, spacing, typography } from '../theme/theme';

/**
 * The answer, shown under the puzzle the moment a round is decided.
 *
 * It sits directly beneath the board rather than down among the option tiles so
 * the player's eyes stay where the question is: at speed, the useful thing is
 * seeing the right answer *next to what was being asked*, not hunting for which
 * of six tiles turned green. The correct option is redrawn here through the
 * same renderer the tiles use, so it reads as the very object that was just
 * being chosen between.
 *
 * Correct and wrong are separated by colour, by the tick or cross, and by
 * wording — three signals, because one of them is colour and some players
 * cannot use it.
 */
export function AnswerReveal({
  option,
  correct,
  explanation,
  /** Bumped per round, so a repeat outcome still replays the animation. */
  trigger,
}: {
  option: PuzzleOption;
  correct: boolean;
  explanation: string;
  trigger: number;
}): React.ReactElement {
  const enter = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enter.setValue(0);
    pop.setValue(0);

    const animation = Animated.parallel([
      Animated.timing(enter, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      // The tile lands a beat after the card, which is what makes the answer
      // read as arriving rather than as having always been there. Kept brief:
      // a correct answer only holds the screen for a moment before the next
      // puzzle, so the whole thing has to settle well inside that.
      Animated.sequence([
        Animated.delay(60),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [trigger, enter, pop]);

  const tone = correct ? colors.success : colors.danger;
  const wash = correct ? colors.successSoft : colors.dangerSoft;

  return (
    <Animated.View
      style={[
        styles.card,
        elevation('low'),
        { borderColor: wash },
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.tile,
          { borderColor: colors.success, backgroundColor: colors.successSoft },
          {
            transform: [
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
            ],
          },
        ]}
      >
        <OptionContentView
          content={option.content}
          width={TILE - 12}
          height={TILE - 12}
          textStyle={styles.tileText}
        />
      </Animated.View>

      <View style={styles.text}>
        <View style={styles.headline}>
          <Text style={[styles.mark, { color: tone }]}>{correct ? '✓' : '✕'}</Text>
          <Text style={[styles.verdict, { color: tone }]}>
            {correct ? 'Correct' : 'The answer was'}
          </Text>
        </View>
        <Text style={styles.explanation} numberOfLines={3}>
          {explanation}
        </Text>
      </View>
    </Animated.View>
  );
}

const TILE = 68;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    padding: spacing.md,
    width: '100%',
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radii.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  tileText: {
    fontSize: 20,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mark: {
    fontSize: 17,
    fontWeight: '900',
  },
  verdict: {
    ...typography.heading,
  },
  explanation: {
    ...typography.label,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
