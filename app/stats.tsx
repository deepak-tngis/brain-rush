import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../src/components/Screen';
import { Button, Card, ProgressBar, SectionTitle } from '../src/components/ui';
import { PUZZLE_KINDS } from '../src/engine';
import type { PuzzleKind } from '../src/engine';
import { useAndroidBack } from '../src/hooks/useAndroidBack';
import { useProgress } from '../src/state/ProgressProvider';
import { colors, radii, spacing, typography } from '../src/theme/theme';

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
      <View>
        <Button label={'←  Back'} onPress={goBack} tone="ghost" size="small" />
      </View>

      <Text style={styles.title}>Statistics</Text>

      <View style={styles.grid}>
        <Metric label="Games played" value={progress.totalGames} />
        <Metric label="Best score" value={progress.bestScore} tone={colors.primary} />
        <Metric label="Best streak" value={progress.bestStreak} tone={colors.pink} />
        <Metric label="Coins" value={progress.coins} tone={colors.orange} />
        <Metric label="Puzzles answered" value={progress.totalAnswered} />
        <Metric label="Accuracy" value={`${accuracy}%`} tone={colors.success} />
      </View>

      <Card>
        <SectionTitle>Daily challenge</SectionTitle>
        <View style={styles.dailyRow}>
          <Metric label="Current streak" value={progress.daily.currentStreak} tone={colors.pink} compact />
          <Metric label="Best streak" value={progress.daily.bestStreak} compact />
          <Metric label="Best score" value={progress.daily.bestScore} compact />
        </View>
      </Card>

      <Card>
        <SectionTitle>Accuracy by puzzle type</SectionTitle>
        {progress.totalAnswered === 0 ? (
          <Text style={styles.empty}>Play a round and your strengths will show up here.</Text>
        ) : (
          <View style={styles.kindList}>
            {ranked.map(({ kind, seen, rate }) => (
              <View key={kind} style={styles.kindRow}>
                <View style={styles.kindHeader}>
                  <Text style={styles.kindName}>{KIND_LABELS[kind]}</Text>
                  <Text style={styles.kindValue}>
                    {seen === 0 ? '-' : `${Math.round(rate * 100)}%`}
                  </Text>
                </View>
                <ProgressBar
                  value={rate}
                  height={6}
                  tone={rate >= 0.7 ? colors.success : rate >= 0.4 ? colors.orange : colors.danger}
                />
                <Text style={styles.kindSeen}>
                  {seen === 0 ? 'not played yet' : `${seen} answered`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

function Metric({
  label,
  value,
  tone = colors.text,
  compact = false,
}: {
  label: string;
  value: string | number;
  tone?: string;
  compact?: boolean;
}): React.ReactElement {
  return (
    <View style={[styles.metric, compact ? styles.metricCompact : styles.metricCard]}>
      <Text style={[styles.metricValue, { color: tone }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metric: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  metricCompact: {
    flex: 1,
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
  dailyRow: {
    flexDirection: 'row',
    gap: spacing.md,
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
  },
  kindName: {
    ...typography.label,
    color: colors.text,
  },
  kindValue: {
    ...typography.label,
    color: colors.textMuted,
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
