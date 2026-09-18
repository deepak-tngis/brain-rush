import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EnterView } from '../src/components/Feedback';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Button, Card, ProgressBar, SectionTitle, StatPill } from '../src/components/ui';
import { DAILY_QUESTION_COUNT, dailyKey } from '../src/engine';
import { useAndroidBack } from '../src/hooks/useAndroidBack';
import { useGame } from '../src/state/GameProvider';
import { useProgress } from '../src/state/ProgressProvider';
import { colors, elevation, radii, spacing, typography } from '../src/theme/theme';

/**
 * The daily challenge is the same ten puzzles for everyone, derived from the
 * date alone. No network, no account, no server: see `src/engine/daily.ts`.
 */
export default function DailyScreen(): React.ReactElement {
  const router = useRouter();
  const progress = useProgress();
  const { start } = useGame();

  const todayKey = dailyKey();
  const completed = progress.daily.lastCompletedKey === todayKey;

  const goBack = useCallback(() => {
    router.back();
    return true;
  }, [router]);

  useAndroidBack(goBack);

  const play = useCallback(() => {
    start('daily');
    router.push('/game');
  }, [router, start]);

  const readableDate = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [],
  );

  return (
    <Screen scroll contentStyle={styles.content}>
      <ScreenHeader title="Daily Challenge" subtitle={readableDate} onBack={goBack} />

      <EnterView style={styles.hero}>
        <Text style={styles.emoji}>{'\u{1F4C5}'}</Text>
        <Text style={styles.blurb}>
          {DAILY_QUESTION_COUNT} puzzles, identical for every player, generated on your device. It
          works with no signal at all.
        </Text>
      </EnterView>

      <View style={styles.stats}>
        <StatPill
          icon={'\u{1F525}'}
          value={progress.daily.currentStreak}
          label="day streak"
          tone={colors.pink}
        />
        <StatPill
          icon={'\u{1F3C6}'}
          value={progress.daily.bestStreak}
          label="best run"
          tone={colors.primary}
        />
        <StatPill
          icon={'⭐'}
          value={progress.daily.bestScore}
          label="best score"
          tone={colors.orange}
        />
      </View>

      {completed ? (
        <Card style={styles.doneCard}>
          <Text style={styles.doneTitle}>{'✓'} Today is done</Text>
          <Text style={styles.doneScore}>You scored {progress.daily.lastScore}</Text>
          <Text style={styles.doneHint}>
            Play it again for practice - the completion bonus is once a day.
          </Text>
        </Card>
      ) : (
        <Card style={styles.rewardCard}>
          <SectionTitle>On completion</SectionTitle>
          <View style={styles.rewardRow}>
            <Text style={styles.rewardValue}>+50 coins</Text>
            <Text style={styles.rewardHint}>and your streak moves on a day</Text>
          </View>
          <ProgressBar value={completed ? 1 : 0} tone={colors.pink} />
        </Card>
      )}

      <Button
        label={completed ? 'Play again' : 'Start the challenge'}
        onPress={play}
        tone={completed ? 'neutral' : 'pink'}
        size="large"
        icon={'▶'}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  emoji: {
    fontSize: 52,
  },
  blurb: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  doneCard: {
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
    ...elevation('low'),
  },
  doneTitle: {
    ...typography.heading,
    color: colors.success,
  },
  doneScore: {
    ...typography.title,
    color: colors.text,
  },
  doneHint: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: 'center',
  },
  rewardCard: {
    gap: spacing.sm,
    borderRadius: radii.lg,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  rewardValue: {
    ...typography.heading,
    color: colors.orange,
  },
  rewardHint: {
    ...typography.label,
    color: colors.textMuted,
    flexShrink: 1,
  },
});
