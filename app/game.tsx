import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';

import { showRewardedAd } from '../src/ads/adManager';
import { haptic } from '../src/audio/haptics';
import { playSound } from '../src/audio/soundManager';
import { ResultBanner, ScorePop, ShakeView, StreakBurst } from '../src/components/Feedback';
import { OptionGrid } from '../src/components/OptionGrid';
import type { OptionFeedback } from '../src/components/OptionGrid';
import { PuzzleBoardView } from '../src/components/PuzzleBoardView';
import { RewardSheet } from '../src/components/RewardSheet';
import { Screen } from '../src/components/Screen';
import { Button, LifeRow, ProgressBar } from '../src/components/ui';
import { isAnswerRevealed, totalQuestions } from '../src/engine';
import { useAndroidBack } from '../src/hooks/useAndroidBack';
import { useCountdown } from '../src/hooks/useCountdown';
import { useAsyncGuard } from '../src/hooks/useTapGuard';
import { useGame } from '../src/state/GameProvider';
import { useProgress } from '../src/state/ProgressProvider';
import { colors, elevation, radii, spacing, typography } from '../src/theme/theme';

/** How long the result stays on screen before the next puzzle arrives. */
const FEEDBACK_MS = { correct: 750, wrong: 1700 } as const;

type Phase = 'study' | 'question' | 'feedback';

/** Which rewarded-ad offer the sheet is currently making, if any. */
type RewardMode = 'reveal' | 'life' | null;

/** Offering a life back only makes sense on the player's last one. */
const LOW_LIFE_THRESHOLD = 1;

export default function GameScreen(): React.ReactElement {
  const router = useRouter();
  const progress = useProgress();
  const { session, puzzle, submit, next, grantReveal, grantExtraLife } = useGame();

  const [phase, setPhase] = useState<Phase>('question');
  const [feedback, setFeedback] = useState<Record<string, OptionFeedback>>({});
  const [banner, setBanner] = useState<{ correct: boolean; text: string } | null>(null);
  const [burst, setBurst] = useState({ streak: 0, tick: 0 });
  const [shakeTick, setShakeTick] = useState(0);
  const [scorePop, setScorePop] = useState({ points: 0, tick: 0 });
  const [rewardMode, setRewardMode] = useState<RewardMode>(null);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(true);
  /** Measured rather than assumed, so the board fits any screen. */
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardGuard = useAsyncGuard();
  /**
   * The countdown is created below (it needs `handleAnswer` for its expiry), so
   * the elapsed-time reader is routed through a ref to keep the two decoupled.
   */
  const elapsedRef = useRef<() => number>(() => 0);

  const puzzleId = puzzle?.id ?? 'none';
  const revealed = session !== null && isAnswerRevealed(session);

  // A puzzle that needs memorising opens with its study phase.
  useEffect(() => {
    if (puzzle === null) return;
    setFeedback({});
    setBanner(null);
    setPhase(puzzle.memory === undefined ? 'question' : 'study');
  }, [puzzleId, puzzle]);

  // The study board is shown for exactly as long as the generator asked.
  useEffect(() => {
    if (phase !== 'study' || puzzle?.memory === undefined) return undefined;
    const timer = setTimeout(() => setPhase('question'), puzzle.memory.studyMs);
    return () => clearTimeout(timer);
  }, [phase, puzzle]);

  // Backgrounding the app must not run the clock down behind the player's back.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setAppActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  useEffect(
    () => () => {
      if (advanceTimer.current !== null) clearTimeout(advanceTimer.current);
    },
    [],
  );

  // The run is over: hand off to the game-over screen, which owns the ad and
  // continue offers. `replace` keeps Back from returning to a dead board.
  useEffect(() => {
    if (session === null) {
      router.replace('/');
      return;
    }
    if (session.status === 'gameOver' || session.status === 'completed') {
      router.replace('/game-over');
    }
  }, [session, router]);

  // The clock stops for the reward sheet, for a backgrounded app, and once the
  // answer has landed - it must never run down where the player cannot see it.
  const clockRunning =
    phase === 'question' && rewardMode === null && appActive && session?.status === 'playing';

  const handleAnswer = useCallback(
    (optionId: string | null, timedOut: boolean) => {
      if (puzzle === null || phase === 'feedback') return;

      const outcome = submit(optionId, elapsedRef.current(), timedOut);
      if (outcome === null) return;

      setPhase('feedback');

      const marks: Record<string, OptionFeedback> = { [puzzle.answerId]: 'correct' };
      if (!outcome.correct && optionId !== null) marks[optionId] = 'wrong';
      setFeedback(marks);

      if (outcome.correct) {
        const streak = session === null ? 1 : session.streak + 1;
        playSound('correct');
        haptic('success');
        setScorePop({ points: outcome.pointsAwarded, tick: Date.now() });
        if (outcome.streakBonusCoins > 0) playSound('streak');
        else if (outcome.coinsAwarded > 0) playSound('coin');
        if (streak >= 2) setBurst({ streak, tick: Date.now() });
        setBanner({
          correct: true,
          text:
            outcome.streakBonusCoins > 0
              ? `+${outcome.pointsAwarded} points and ${outcome.streakBonusCoins} bonus coins!`
              : `+${outcome.pointsAwarded} points`,
        });
      } else {
        playSound('wrong');
        haptic('warning');
        setShakeTick(Date.now());
        setBanner({
          correct: false,
          text: timedOut ? `Out of time. ${puzzle.explanation}` : puzzle.explanation,
        });
      }

      advanceTimer.current = setTimeout(
        () => next(),
        outcome.correct ? FEEDBACK_MS.correct : FEEDBACK_MS.wrong,
      );
    },
    [next, phase, puzzle, session, submit],
  );

  const { remainingMs, elapsed } = useCountdown({
    durationMs: puzzle?.timeLimitMs ?? 10000,
    running: clockRunning,
    resetKey: puzzleId,
    onExpire: () => handleAnswer(null, true),
  });

  elapsedRef.current = elapsed;

  const quit = useCallback(() => {
    Alert.alert('Leave this run?', 'Your coins are already banked, but the run will end.', [
      { text: 'Keep playing', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => router.replace('/'),
      },
    ]);
  }, [router]);

  useAndroidBack(
    useCallback(() => {
      if (rewardMode !== null) {
        setRewardMode(null);
        return true;
      }
      quit();
      return true;
    }, [quit, rewardMode]),
  );

  const watchRewardAd = useCallback(() => {
    const mode = rewardMode;
    if (mode === null) return;

    rewardGuard.run(async () => {
      setRewardBusy(true);
      setRewardError(null);
      const outcome = await showRewardedAd(mode === 'reveal' ? 'reveal-answer' : 'restore-life');
      setRewardBusy(false);

      // The reward is applied only because the SDK reported it was earned.
      if (outcome.granted) {
        if (mode === 'reveal') grantReveal();
        else grantExtraLife();
        setRewardMode(null);
        if (mode === 'life') playSound('coin');
        return;
      }

      // Gameplay is never blocked by an ad: the sheet explains, and the player
      // carries on with the clock exactly where they left it.
      setRewardError(
        outcome.reason === 'dismissed'
          ? 'The advert was closed early, so no reward this time.'
          : 'No advert available right now. Carry on - nothing is lost.',
      );
    });
  }, [grantExtraLife, grantReveal, rewardGuard, rewardMode]);

  const openReward = useCallback((mode: Exclude<RewardMode, null>) => {
    setRewardError(null);
    setRewardMode(mode);
  }, []);

  const optionFeedback = useMemo(() => {
    if (!revealed || puzzle === null || phase === 'feedback') return feedback;
    return { ...feedback, [puzzle.answerId]: 'revealed' as OptionFeedback };
  }, [feedback, phase, puzzle, revealed]);

  if (session === null || puzzle === null) {
    return <Screen />;
  }

  const limit = totalQuestions(session);
  const questionNumber = session.index + 1;
  const timeFraction = puzzle.timeLimitMs === 0 ? 0 : remainingMs / puzzle.timeLimitMs;
  const timerTone =
    timeFraction > 0.5 ? colors.success : timeFraction > 0.25 ? colors.orange : colors.danger;

  const studying = phase === 'study' && puzzle.memory !== undefined;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Button label="Quit" onPress={quit} tone="ghost" size="small" />
        <LifeRow lives={session.lives} />
      </View>

      <View style={[styles.hud, elevation('low')]}>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel}>Score</Text>
          <View>
            <Text style={styles.hudValue}>{session.score}</Text>
            <ScorePop points={scorePop.points} trigger={scorePop.tick} />
          </View>
        </View>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel}>Coins</Text>
          <Text style={[styles.hudValue, { color: colors.orange }]}>{progress.coins}</Text>
        </View>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel}>Streak</Text>
          <Text style={[styles.hudValue, { color: colors.pink }]}>
            {'⚡'} {session.streak}
          </Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <Text style={styles.questionCount}>
          {limit === null ? `Question ${questionNumber}` : `Question ${questionNumber} of ${limit}`}
        </Text>
        <Text style={[styles.difficulty, { color: colors.textMuted }]}>{puzzle.difficulty}</Text>
      </View>
      <ProgressBar
        value={limit === null ? (questionNumber % 10) / 10 : session.index / limit}
        tone={colors.primary}
      />

      <View style={styles.timerRow}>
        <ProgressBar value={timeFraction} tone={timerTone} height={6} />
      </View>

      <ShakeView trigger={shakeTick} style={styles.stage}>
        <Text style={styles.puzzleTitle}>{puzzle.title}</Text>
        <Text style={styles.instruction}>
          {studying ? (puzzle.memory?.studyPrompt ?? '') : puzzle.instruction}
        </Text>

        <View
          style={styles.board}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setBoardSize((current) =>
              current.width === width && current.height === height ? current : { width, height },
            );
          }}
        >
          {boardSize.width > 0 ? (
            <PuzzleBoardView
              board={studying ? (puzzle.memory?.board ?? puzzle.board) : puzzle.board}
              width={boardSize.width}
              height={boardSize.height}
            />
          ) : null}
        </View>
      </ShakeView>

      {banner !== null ? <ResultBanner correct={banner.correct} text={banner.text} /> : null}

      {studying ? (
        <View style={styles.studyNote}>
          <Text style={styles.studyText}>Memorise...</Text>
        </View>
      ) : (
        <View style={styles.answers}>
          <OptionGrid
            options={puzzle.options}
            layout={puzzle.optionLayout}
            onSelect={(optionId) => handleAnswer(optionId, false)}
            feedback={optionFeedback}
            disabled={phase !== 'question'}
          />
        </View>
      )}

      {!studying && phase === 'question' ? (
        <View style={styles.helpRow}>
          {!revealed ? (
            <Button
              label="Reveal the answer"
              icon={'\u{1F4A1}'}
              tone="ghost"
              size="small"
              onPress={() => openReward('reveal')}
            />
          ) : null}
          {session.lives <= LOW_LIFE_THRESHOLD ? (
            <Button
              label="Get a life back"
              icon={'\u2764'}
              tone="ghost"
              size="small"
              onPress={() => openReward('life')}
            />
          ) : null}
        </View>
      ) : null}

      <StreakBurst streak={burst.streak} trigger={burst.tick} />

      <RewardSheet
        visible={rewardMode !== null}
        title={rewardMode === 'life' ? 'One more life?' : 'Need a hint?'}
        message={
          rewardMode === 'life'
            ? 'Watch a short advert to take another heart into the rest of the run.'
            : "Watch a short advert and this puzzle's answer will be highlighted."
        }
        confirmLabel={rewardMode === 'life' ? 'Watch and revive' : 'Watch and reveal'}
        declineLabel="No thanks"
        busy={rewardBusy}
        error={rewardError}
        onConfirm={watchRewardAd}
        onDecline={() => setRewardMode(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  hudItem: {
    alignItems: 'center',
    gap: 2,
  },
  hudLabel: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  hudValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  questionCount: {
    ...typography.label,
    color: colors.textMuted,
  },
  difficulty: {
    ...typography.caption,
    textTransform: 'uppercase',
  },
  timerRow: {
    marginTop: spacing.sm,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginVertical: spacing.sm,
    minHeight: 0,
  },
  puzzleTitle: {
    ...typography.caption,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  instruction: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  board: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  answers: {
    marginTop: spacing.md,
  },
  studyNote: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  studyText: {
    ...typography.heading,
    color: colors.primary,
  },
  helpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
