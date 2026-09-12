import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { maybeShowInterstitial, showRewardedAd } from '../src/ads/adManager';
import { playSound } from '../src/audio/soundManager';
import { RewardSheet } from '../src/components/RewardSheet';
import { Screen } from '../src/components/Screen';
import { Button, Card, StatPill } from '../src/components/ui';
import { useAndroidBack } from '../src/hooks/useAndroidBack';
import { useAsyncGuard } from '../src/hooks/useTapGuard';
import { useGame } from '../src/state/GameProvider';
import { useProgress } from '../src/state/ProgressProvider';
import { colors, elevation, spacing, typography } from '../src/theme/theme';

type RewardMode = 'continue' | null;

/**
 * End of a run.
 *
 * The interstitial is offered here — never mid-puzzle — and only when the
 * frequency rules in `src/ads/interstitialPolicy.ts` allow it. Whether or not an
 * ad appears, the screen is already interactive: an ad failure is invisible to
 * the player.
 */
export default function GameOverScreen(): React.ReactElement {
  const router = useRouter();
  const progress = useProgress();
  const { session, grantContinue, clear, start, canContinue } = useGame();

  const [rewardMode, setRewardMode] = useState<RewardMode>(null);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const rewardGuard = useAsyncGuard();

  const completed = session?.status === 'completed';
  const isDaily = session?.config.mode === 'daily';
  const soundPlayed = useRef(false);

  useEffect(() => {
    if (session === null) {
      router.replace('/');
      return;
    }
    if (soundPlayed.current) return;
    soundPlayed.current = true;
    playSound(completed ? 'levelComplete' : 'gameOver');
  }, [completed, router, session]);

  // Ads are requested after the screen is up and are never awaited by the UI.
  useEffect(() => {
    void maybeShowInterstitial({ puzzleActive: false });
  }, []);

  const goHome = useCallback(() => {
    clear();
    router.replace('/');
  }, [clear, router]);

  const playAgain = useCallback(() => {
    // Replays the mode that just ended; a repeated daily is practice only, since
    // its completion bonus is paid once per day.
    start(session?.config.mode ?? 'endless');
    router.replace('/game');
  }, [router, session, start]);

  useAndroidBack(
    useCallback(() => {
      if (rewardMode !== null) {
        setRewardMode(null);
        return true;
      }
      goHome();
      return true;
    }, [goHome, rewardMode]),
  );

  const watchContinueAd = useCallback(() => {
    rewardGuard.run(async () => {
      setRewardBusy(true);
      setRewardError(null);
      const outcome = await showRewardedAd('continue-run');
      setRewardBusy(false);

      if (outcome.granted) {
        grantContinue();
        setRewardMode(null);
        router.replace('/game');
        return;
      }
      setRewardError(
        outcome.reason === 'dismissed'
          ? 'The advert was closed early, so the run stays finished.'
          : 'No advert available right now - your score is safe either way.',
      );
    });
  }, [grantContinue, rewardGuard, router]);

  if (session === null) return <Screen />;

  const isBestScore = session.score > 0 && session.score >= progress.bestScore;
  const accuracy =
    session.correctCount + session.wrongCount === 0
      ? 0
      : Math.round((session.correctCount / (session.correctCount + session.wrongCount)) * 100);

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>{completed ? '\u{1F389}' : '\u{1F9E0}'}</Text>
        <Text style={styles.title}>
          {completed ? (isDaily ? 'Daily complete!' : 'Run complete!') : 'Out of lives'}
        </Text>
        {isBestScore ? <Text style={styles.newBest}>New best score!</Text> : null}
      </View>

      <Card style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Score</Text>
        <Text style={styles.scoreValue}>{session.score}</Text>
        <View style={styles.scoreRow}>
          <StatPill icon={'\u{1FA99}'} value={`+${session.coinsEarned}`} label="earned" tone={colors.orange} />
          <StatPill icon={'⚡'} value={session.bestStreakInRun} label="best streak" tone={colors.pink} />
          <StatPill icon={'✓'} value={`${accuracy}%`} label="accuracy" tone={colors.success} />
        </View>
      </Card>

      {completed && isDaily ? (
        <Card style={styles.dailyCard}>
          <Text style={styles.dailyText}>
            {'\u{1F525}'} {progress.daily.currentStreak} day
            {progress.daily.currentStreak === 1 ? '' : 's'} in a row
          </Text>
          <Text style={styles.dailyHint}>+50 coins for finishing today&apos;s challenge.</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        {!completed && canContinue ? (
          <Button
            label="Continue this run"
            subtitle="Watch an advert - keep your streak"
            onPress={() => {
              setRewardError(null);
              setRewardMode('continue');
            }}
            tone="orange"
            size="large"
            icon={'❤'}
          />
        ) : null}

        <Button label="Play again" onPress={playAgain} tone="primary" size="large" icon={'↺'} />
        <Button label="Home" onPress={goHome} tone="neutral" icon={'⌂'} />
      </View>

      <RewardSheet
        visible={rewardMode === 'continue'}
        title="Back from the brink"
        message="Watch a short advert to get a life back and carry on with the streak you had."
        confirmLabel="Watch and continue"
        declineLabel="End the run"
        busy={rewardBusy}
        error={rewardError}
        onConfirm={watchContinueAd}
        onDecline={() => setRewardMode(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  newBest: {
    ...typography.label,
    color: colors.orange,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreCard: {
    alignItems: 'center',
    gap: spacing.sm,
    ...elevation('medium'),
  },
  scoreLabel: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '900',
    color: colors.primary,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dailyCard: {
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
  },
  dailyText: {
    ...typography.heading,
    color: colors.success,
  },
  dailyHint: {
    ...typography.label,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.md,
  },
});
