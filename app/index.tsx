import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

import { BrainLogo } from '../src/components/BrainLogo';
import { PulseView } from '../src/components/Feedback';
import { Screen } from '../src/components/Screen';
import { Button, Card, StatPill } from '../src/components/ui';
import { dailyKey } from '../src/engine';
import { useAndroidBack } from '../src/hooks/useAndroidBack';
import { useGame } from '../src/state/GameProvider';
import { useProgress } from '../src/state/ProgressProvider';
import { colors, radii, spacing, typography } from '../src/theme/theme';

export default function HomeScreen(): React.ReactElement {
  const router = useRouter();
  const progress = useProgress();
  const { start } = useGame();

  const todayKey = dailyKey();
  const dailyDone = progress.daily.lastCompletedKey === todayKey;

  // Home is the root of the stack: back here means "leave the game", which is
  // the Android-native expectation, so hand the press back to the OS.
  useAndroidBack(
    useCallback(() => {
      BackHandler.exitApp();
      return true;
    }, []),
  );

  const playEndless = useCallback(() => {
    start('endless');
    router.push('/game');
  }, [router, start]);

  const openDaily = useCallback(() => {
    router.push('/daily');
  }, [router]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <BrainLogo size={104} />
        <Text style={styles.wordmark}>BRAIN RUSH</Text>
        <Text style={styles.tagline}>Twelve puzzle types. Five seconds each. Go.</Text>
      </View>

      <View style={styles.stats}>
        <StatPill icon={'\u{1FA99}'} value={progress.coins} label="coins" tone={colors.orange} />
        <StatPill icon={'⚡'} value={progress.bestStreak} label="best streak" tone={colors.pink} />
        <StatPill icon={'\u{1F3C6}'} value={progress.bestScore} label="best score" tone={colors.primary} />
      </View>

      <View style={styles.actions}>
        <PulseView>
          <Button label="PLAY" onPress={playEndless} tone="primary" size="large" icon={'▶'} />
        </PulseView>

        <Button
          label="Daily Challenge"
          subtitle={dailyDone ? 'Completed today' : '10 puzzles - resets at midnight'}
          onPress={openDaily}
          tone={dailyDone ? 'neutral' : 'pink'}
          size="large"
          icon={dailyDone ? '✓' : '\u{1F4C5}'}
        />
      </View>

      {progress.daily.currentStreak > 0 ? (
        <Card style={styles.streakCard}>
          <Text style={styles.streakValue}>
            {'\u{1F525}'} {progress.daily.currentStreak} day
            {progress.daily.currentStreak === 1 ? '' : 's'} in a row
          </Text>
          <Text style={styles.streakHint}>
            {dailyDone
              ? 'Come back tomorrow to keep it going.'
              : "Today's challenge is still waiting."}
          </Text>
        </Card>
      ) : null}

      <View style={styles.footer}>
        <Button
          label="Statistics"
          onPress={() => router.push('/stats')}
          tone="neutral"
          style={styles.footerButton}
          icon={'\u{1F4CA}'}
        />
        <Button
          label="Settings"
          onPress={() => router.push('/settings')}
          tone="neutral"
          style={styles.footerButton}
          icon={'⚙'}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    ...typography.display,
    color: colors.text,
  },
  tagline: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  streakCard: {
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
  },
  streakValue: {
    ...typography.heading,
    color: colors.text,
  },
  streakHint: {
    ...typography.label,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerButton: {
    flex: 1,
  },
});
