import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { EnterView } from '../src/components/Feedback';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Card, ProgressBar, SectionTitle } from '../src/components/ui';
import { PUZZLE_KINDS } from '../src/engine';
import type { PuzzleKind } from '../src/engine';
import { useAndroidBack } from '../src/hooks/useAndroidBack';
import { useProgress } from '../src/state/ProgressProvider';
import { colors, elevation, radii, spacing, typography } from '../src/theme/theme';

const KIND_LABELS: Record<PuzzleKind, string> = {
  oddOneOut: 'Odd One Out',
  numberSequence: 'Number Sequence',
  shapePattern: 'Shape Pattern',
  missingNumber: 'Missing Number',
  quickMath: 'Quick Math',
  memory: 'Memory',
  countObjects: 'Count Objects',
  colorLogic: 'Colour Logic',
  spatialReasoning: 'Spatial Reasoning',
  whichIsDifferent: 'Which Is Different?',
  matching: 'Matching',
  symbolSequence: 'Symbol Sequence',
};

/** Rosettes for the three strongest types the player has actually attempted. */
const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

export default function StatsScreen(): React.ReactElement {
  const router = useRouter();
  const progress = useProgress();

  const goBack = useCallback(() => {
    router.back();
    return true;
  }, [router]);

  useAndroidBack(goBack);

  const accuracy =
    progress.totalAnswered === 0
      ? 0
      : Math.round((progress.totalCorrect / progress.totalAnswered) * 100);

  // Strongest types first; types never played sit at the bottom, unranked.
  const ranked = useMemo(
    () =>
      PUZZLE_KINDS.map((kind) => {
        const stat = progress.kindStats[kind];
        return {
          kind,
          seen: stat.seen,
          rate: stat.seen === 0 ? 0 : stat.correct / stat.seen,
        };
      }).sort((a, b) => (b.seen === 0 ? -1 : 0) - (a.seen === 0 ? -1 : 0) || b.rate - a.rate),
    [progress.kindStats],
  );

  return (
    <Screen scroll contentStyle={styles.content}>
      <ScreenHeader
        title="Statistics"
        subtitle={progress.totalGames === 1 ? '1 game played' : `${progress.totalGames} games played`}
        onBack={goBack}
      />

      <EnterView>
        <Card style={styles.hero}>
          <AccuracyRing value={accuracy / 100} />
          <View style={styles.heroText}>
            <Text style={styles.heroLabel}>Overall accuracy</Text>
            <Text style={styles.heroDetail}>
              {progress.totalAnswered === 0
                ? 'No answers recorded yet.'
                : `${progress.totalCorrect} correct of ${progress.totalAnswered} answered`}
            </Text>
            <View style={styles.heroChips}>
              <Chip icon={'\u{1F3C6}'} value={progress.bestScore} label="best" />
              <Chip icon={'⚡'} value={progress.bestStreak} label="streak" />
              <Chip icon={'\u{1FA99}'} value={progress.coins} label="coins" />
            </View>
          </View>
        </Card>
      </EnterView>

      <EnterView delay={70}>
        <Card>
          <SectionTitle>Daily challenge</SectionTitle>
          <View style={styles.dailyRow}>
            <Metric label="Current streak" value={progress.daily.currentStreak} tone={colors.pink} />
            <View style={styles.dailySplit} />
            <Metric label="Best streak" value={progress.daily.bestStreak} />
            <View style={styles.dailySplit} />
            <Metric label="Best score" value={progress.daily.bestScore} />
          </View>
        </Card>
      </EnterView>

      <EnterView delay={140}>
        <Card>
          <SectionTitle>Accuracy by puzzle type</SectionTitle>
          {progress.totalAnswered === 0 ? (
            <Text style={styles.empty}>Play a round and your strengths will show up here.</Text>
          ) : (
            <View style={styles.kindList}>
              {ranked.map(({ kind, seen, rate }, index) => {
                const medal = seen > 0 && index < MEDALS.length ? MEDALS[index] : null;
                return (
                  <View key={kind} style={styles.kindRow}>
                    <View style={styles.kindHeader}>
                      <Text style={styles.kindName} numberOfLines={1}>
                        {medal !== null ? `${medal} ` : ''}
                        {KIND_LABELS[kind]}
                      </Text>
                      <Text style={[styles.kindValue, seen === 0 && styles.kindValueIdle]}>
                        {seen === 0 ? '—' : `${Math.round(rate * 100)}%`}
                      </Text>
                    </View>
                    <ProgressBar
                      value={rate}
                      height={6}
                      tone={
                        seen === 0
                          ? colors.border
                          : rate >= 0.7
                            ? colors.success
                            : rate >= 0.4
                              ? colors.orange
                              : colors.danger
                      }
                    />
                    <Text style={styles.kindSeen}>
                      {seen === 0 ? 'not played yet' : `${seen} answered`}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </EnterView>
    </Screen>
  );
}

const RING_SIZE = 104;
const RING_STROKE = 11;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * Accuracy as a dial rather than a number alone.
 *
 * Drawn with a dash offset on a single stroked circle, which is one node and no
 * layout work — cheaper than any arc built out of views, and exact at the ends.
 */
function AccuracyRing({ value }: { value: number }): React.ReactElement {
  const clamped = Math.max(0, Math.min(1, value));
  const tone = clamped >= 0.7 ? colors.success : clamped >= 0.4 ? colors.orange : colors.primary;

  return (
    <View style={styles.ring}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={colors.surfaceMuted}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={tone}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - clamped)}
          // Start the sweep at twelve o'clock instead of three.
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      {/* The dial is a fixed 104pt of drawn geometry, so its readout cannot be
          allowed to grow without bound — at Android's largest font setting the
          number spilled straight over the stroke. Capped rather than frozen, so
          it still responds to the setting as far as the circle allows. */}
      <View style={styles.ringCentre} pointerEvents="none">
        <Text style={[styles.ringValue, { color: tone }]} maxFontSizeMultiplier={1.15}>
          {Math.round(clamped * 100)}
        </Text>
        <Text style={styles.ringUnit} maxFontSizeMultiplier={1.15}>
          %
        </Text>
      </View>
    </View>
  );
}

function Chip({
  icon,
  value,
  label,
}: {
  icon: string;
  value: number;
  label: string;
}): React.ReactElement {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function Metric({
  label,
  value,
  tone = colors.text,
}: {
  label: string;
  value: string | number;
  tone?: string;
}): React.ReactElement {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: tone }]} maxFontSizeMultiplier={1.5}>
        {value}
      </Text>
      {/* Three of these share a row, so each column is narrow. Left uncapped,
          a large system font broke "Current streak" mid-word across lines. */}
      <Text style={styles.metricLabel} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    ...elevation('low'),
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCentre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    // Centred, not baseline-aligned: baseline in an absolutely-positioned box
    // pins the row to the top of it, which shunts the number off the dial.
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 30,
    fontWeight: '900',
  },
  ringUnit: {
    ...typography.label,
    color: colors.textFaint,
    marginLeft: 1,
    // Drops the small unit onto the number's baseline by hand.
    marginTop: 8,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  heroLabel: {
    ...typography.heading,
    color: colors.text,
  },
  heroDetail: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipIcon: {
    fontSize: 11,
  },
  chipValue: {
    ...typography.label,
    color: colors.text,
    fontWeight: '800',
  },
  chipLabel: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'none',
    letterSpacing: 0,
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailySplit: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  kindList: {
    gap: spacing.md,
  },
  kindRow: {
    gap: 4,
  },
  kindHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  kindName: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1,
  },
  kindValue: {
    ...typography.label,
    color: colors.text,
    fontWeight: '800',
  },
  kindValueIdle: {
    color: colors.textFaint,
  },
  kindSeen: {
    ...typography.caption,
    color: colors.textFaint,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
  },
});
