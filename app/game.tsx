import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { showRewardedAd } from '../src/ads/adManager';
import { haptic } from '../src/audio/haptics';
import { setMusicUrgency } from '../src/audio/musicManager';
import { playSound } from '../src/audio/soundManager';
import { AnswerReveal } from '../src/components/AnswerReveal';
import { ScorePop, ShakeView, StreakBurst } from '../src/components/Feedback';
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

/**
 * How long a decided round stays on screen.
 *
 * Correct is a little longer than it used to be so the answer reveal has time
 * to land and be read; it is still brisk, because being right is its own
 * explanation. Wrong dwells far longer — that is the round the player actually
 * needs to learn something from.
 */
const FEEDBACK_MS = { correct: 950, wrong: 1700 } as const;

/**
 * Ceiling on the system font scale for this screen's *chrome* only.
 *
 * The board is the tightest layout in the app: fixed-height HUD, two progress
 * bars, a flexible stage and two rows of option tiles all have to coexist. At
 * Android's largest font setting (2x) the chrome grows past the space available
 * and the puzzle title collides with the timer bars.
 *
 * Only labels and readouts are capped. The question itself, the option text and
 * every other screen scale freely — a player who needs large text still gets it
 * where it carries meaning, which is the part that matters.
 */
const CHROME_FONT_CAP = 1.3;

type Phase = 'study' | 'question' | 'feedback';

/** Which rewarded-ad offer the sheet is currently making, if any. */
type RewardMode = 'reveal' | 'life' | null;

/** Offering a life back only makes sense on the player's last one. */
const LOW_LIFE_THRESHOLD = 1;

export default function GameScreen(): React.ReactElement {
  const router = useRouter();
  const progress = useProgress();
  const { session, puzzle, submit, next, grantReveal, grantExtraLife } = useGame();
  // Short screens give the board less floor to stand on, so it does not
  // squeeze the title and instruction out over the progress bars above.
  const { height: screenHeight } = useWindowDimensions();
  const boardMinHeight = screenHeight < 760 ? 64 : 100;

  const [phase, setPhase] = useState<Phase>('question');
  const [feedback, setFeedback] = useState<Record<string, OptionFeedback>>({});
  const [banner, setBanner] = useState<{
    correct: boolean;
    text: string;
    /** Distinguishes consecutive rounds so the reveal replays its animation. */
    tick: number;
  } | null>(null);
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
          tick: Date.now(),
        });
      } else {
        playSound('wrong');
        haptic('warning');
        setShakeTick(Date.now());
        setBanner({
          correct: false,
          text: timedOut ? `Out of time. ${puzzle.explanation}` : puzzle.explanation,
          tick: Date.now(),
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

  // Lift the music bed over the last quarter of the clock, and drop it the
  // moment the question is answered or replaced. The urgency is already on
  // screen in the bar and its colour; this only makes it audible.
  const urgent =
    clockRunning && puzzle !== null && puzzle.timeLimitMs > 0
      ? remainingMs / puzzle.timeLimitMs <= 0.25
      : false;

  useEffect(() => {
    setMusicUrgency(urgent);
  }, [urgent]);

  // Leaving the board must never strand the bed in its lifted state.
  useEffect(() => () => setMusicUrgency(false), []);

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
      // No explicit music handling: a rewarded advert opens its own activity,
      // which pauses this one and fires the AppState change the bootstrap
      // already suspends on. Suspending around this call instead would silence
      // the bed through every request that never fills.
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

  // Stable identity, so the memoised option grid is not re-rendered by the
  // countdown's ten-times-a-second tick.
  const selectOption = useCallback(
    (optionId: string) => handleAnswer(optionId, false),
    [handleAnswer],
  );

  if (session === null || puzzle === null) {
    return <Screen />;
  }

  const limit = totalQuestions(session);
  const questionNumber = session.index + 1;
  const timeFraction = puzzle.timeLimitMs === 0 ? 0 : remainingMs / puzzle.timeLimitMs;
  const timerTone =
    timeFraction > 0.5 ? colors.success : timeFraction > 0.25 ? colors.orange : colors.danger;

  const studying = phase === 'study' && puzzle.memory !== undefined;
  const answerOption = puzzle.options.find((option) => option.id === puzzle.answerId);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Button label="Quit" onPress={quit} tone="ghost" size="small" style={styles.quit} />
        <LifeRow lives={session.lives} />
      </View>

      <View style={[styles.hud, elevation('low')]}>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel} maxFontSizeMultiplier={CHROME_FONT_CAP}>Score</Text>
          <View>
            <Text style={styles.hudValue} maxFontSizeMultiplier={CHROME_FONT_CAP}>{session.score}</Text>
            <ScorePop points={scorePop.points} trigger={scorePop.tick} />
          </View>
        </View>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel} maxFontSizeMultiplier={CHROME_FONT_CAP}>Coins</Text>
          <Text
              style={[styles.hudValue, { color: colors.orange }]}
              maxFontSizeMultiplier={CHROME_FONT_CAP}
            >
              {progress.coins}
            </Text>
        </View>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel} maxFontSizeMultiplier={CHROME_FONT_CAP}>Streak</Text>
          <Text
              style={[styles.hudValue, { color: colors.pink }]}
              maxFontSizeMultiplier={CHROME_FONT_CAP}
            >
            {'⚡'} {session.streak}
          </Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <Text style={styles.questionCount} maxFontSizeMultiplier={CHROME_FONT_CAP}>
          {limit === null ? `Question ${questionNumber}` : `Question ${questionNumber} of ${limit}`}
        </Text>
        <Text
          style={[styles.difficulty, { color: colors.textMuted }]}
          maxFontSizeMultiplier={CHROME_FONT_CAP}
        >
          {puzzle.difficulty}
        </Text>
      </View>
      <ProgressBar
        value={limit === null ? (questionNumber % 10) / 10 : session.index / limit}
        tone={colors.primary}
      />

      <View style={styles.timerRow}>
        <ProgressBar value={timeFraction} tone={timerTone} height={6} />
      </View>

      <View style={styles.stageWrap}>
        <ShakeView trigger={shakeTick} style={styles.stage}>
          <Text style={styles.puzzleTitle} maxFontSizeMultiplier={CHROME_FONT_CAP}>
            {puzzle.title}
          </Text>
          <Text style={styles.instruction}>
            {studying ? (puzzle.memory?.studyPrompt ?? '') : puzzle.instruction}
          </Text>

          <View
            style={[styles.board, { minHeight: boardMinHeight }]}
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

        {/* Overlaid on the foot of the board rather than placed in the flow.
            This screen is already tight on a phone, and reserving a slot for
            the card squeezed the stage until the puzzle title collided with the
            timer bars. As an overlay it costs no layout at all, so nothing
            above or below it can move when a round resolves. */}
        {banner !== null && answerOption !== undefined ? (
          <View style={styles.revealOverlay} pointerEvents="none">
            <AnswerReveal
              option={answerOption}
              correct={banner.correct}
              explanation={banner.text}
              trigger={banner.tick}
            />
          </View>
        ) : null}
      </View>

      {studying ? (
        <View style={styles.studyNote}>
          <Text style={styles.studyText}>Memorise...</Text>
        </View>
      ) : (
        <View style={styles.answers}>
          <OptionGrid
            options={puzzle.options}
            layout={puzzle.optionLayout}
            onSelect={selectOption}
            feedback={optionFeedback}
            disabled={phase !== 'question'}
          />
        </View>
      )}

      {/* Rendered for the whole round, not just while the question is live.
          Gating this on `phase === 'question'` unmounted both buttons the
          instant an answer landed, so the help row vanished from under the
          player's finger and everything below it jumped. They stay put and go
          inert instead \u2014 there is nothing to reveal once the round is decided,
          but the row still has to hold its ground. */}
      {!studying ? (
        <View style={styles.helpRow}>
          {!revealed ? (
            <Button
              label="Reveal the answer"
              icon={'\u{1F4A1}'}
              tone="ghost"
              size="small"
              style={styles.helpButton}
              disabled={phase !== 'question'}
              onPress={() => openReward('reveal')}
            />
          ) : null}
          {session.lives <= LOW_LIFE_THRESHOLD ? (
            <Button
              label="Get a life back"
              icon={'\u2764'}
              tone="ghost"
              size="small"
              style={styles.helpButton}
              disabled={phase !== 'question'}
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
  // Trims the button's default side padding so "Quit" lines up with the left
  // edge of the HUD card below it rather than floating inboard of everything.
  quit: {
    paddingHorizontal: spacing.sm,
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
    alignItems: 'center',
    gap: spacing.sm,
    // Holds the row's height even when the reveal button has been spent, so
    // buying a hint does not shuffle the board. No wrapping: when both offers
    // are up they must stay on one line, or the row doubles in height and
    // steals it from the puzzle above.
    minHeight: 42,
  },
  helpButton: {
    paddingHorizontal: spacing.sm,
    flexShrink: 1,
  },
  stageWrap: {
    flex: 1,
    minHeight: 0,
  },
  revealOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
