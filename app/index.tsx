import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

import { BrainLogo } from '../src/components/BrainLogo';
import { EnterView, FloatView, PulseView } from '../src/components/Feedback';
import { PressableScale } from '../src/components/PressableScale';
import { Screen } from '../src/components/Screen';
import { Button, Divider, IconBadge } from '../src/components/ui';
import { dailyKey } from '../src/engine';
import { useAndroidBack } from '../src/hooks/useAndroidBack';
import { useGame } from '../src/state/GameProvider';
import { useProgress } from '../src/state/ProgressProvider';
import { colors, elevation, gradients, radii, spacing, typography } from '../src/theme/theme';

export default function HomeScreen(): React.ReactElement {
  const router = useRouter();
  const progress = useProgress();
  const { start } = useGame();
  // Home stays mounted underneath the board, so its idle animations have to be
  // told to stop — otherwise they drive the animation loop for the whole game.
  const focused = useIsFocused();

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
    <View style={styles.root}>
      {/* A wash rather than a flat fill, so the white cards read as sitting on
          top of the screen instead of being cut out of it. */}
      <LinearGradient
        colors={[...gradients.sky]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Screen scroll style={styles.screen} contentStyle={styles.content}>
        <EnterView style={styles.header}>
          <FloatView active={focused}>
            <View style={styles.logoRing}>
              <BrainLogo size={92} />
            </View>
          </FloatView>
          <Text style={styles.wordmark}>BRAIN RUSH</Text>
          <View style={styles.taglineRow}>
            <Text style={styles.taglineChip}>12 puzzle types</Text>
            <Text style={styles.taglineDot}>{'•'}</Text>
            <Text style={styles.taglineChip}>5 seconds each</Text>
          </View>
        </EnterView>

        <EnterView delay={80}>
          <View style={[styles.statStrip, elevation('low')]}>
            <Stat icon={'\u{1FA99}'} value={progress.coins} label="coins" tone={colors.orange} />
            <View style={styles.statSplit} />
            <Stat icon={'⚡'} value={progress.bestStreak} label="best streak" tone={colors.pink} />
            <View style={styles.statSplit} />
            <Stat
              icon={'\u{1F3C6}'}
              value={progress.bestScore}
              label="best score"
              tone={colors.primary}
            />
          </View>
        </EnterView>

        <EnterView delay={160} style={styles.actions}>
          <PulseView active={focused}>
            <Button label="PLAY" onPress={playEndless} tone="primary" size="large" icon={'▶'} />
          </PulseView>

          <PressableScale
            onPress={openDaily}
            accessibilityLabel="Daily Challenge"
            style={[styles.dailyCard, dailyDone && styles.dailyCardDone, elevation('low')]}
          >
            <IconBadge
              icon={dailyDone ? '✓' : '\u{1F4C5}'}
              tint={dailyDone ? colors.successSoft : colors.pinkSoft}
              size={46}
            />
            <View style={styles.dailyText}>
              <Text style={styles.dailyTitle}>Daily Challenge</Text>
              <Text style={styles.dailyHint}>
                {dailyDone ? 'Completed today' : '10 puzzles · resets at midnight'}
              </Text>
            </View>
            {progress.daily.currentStreak > 0 ? (
              <View style={styles.streakTag}>
                <Text style={styles.streakTagText}>
                  {'\u{1F525}'} {progress.daily.currentStreak}
                </Text>
              </View>
            ) : null}
            <Text style={styles.chevron}>{'›'}</Text>
          </PressableScale>
        </EnterView>

        <View style={styles.spacer} />

        <EnterView delay={240}>
          <View style={[styles.footerCard, elevation('low')]}>
            <FooterRow
              icon={'\u{1F4CA}'}
              tint={colors.primarySoft}
              label="Statistics"
              hint="Accuracy by puzzle type"
              onPress={() => router.push('/stats')}
            />
            <Divider />
            <FooterRow
              icon={'⚙'}
              tint={colors.purpleSoft}
              label="Settings"
              hint="Sound, vibration and adverts"
              onPress={() => router.push('/settings')}
            />
          </View>
        </EnterView>
      </Screen>
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: string;
  value: number;
  label: string;
  tone: string;
}): React.ReactElement {
  return (
    <View style={styles.stat}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FooterRow({
  icon,
  tint,
  label,
  hint,
  onPress,
}: {
  icon: string;
  tint: string;
  label: string;
  hint: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={styles.footerRow}
      pressedScale={0.98}
    >
      <IconBadge icon={icon} tint={tint} size={38} />
      <View style={styles.footerText}>
        <Text style={styles.footerLabel}>{label}</Text>
        <Text style={styles.footerHint}>{hint}</Text>
      </View>
      <Text style={styles.chevron}>{'›'}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    backgroundColor: 'transparent',
  },
  content: {
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  logoRing: {
    width: 132,
    height: 132,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wordmark: {
    ...typography.display,
    color: colors.text,
    letterSpacing: 0.5,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Wraps rather than running off both edges of the screen. At Android's
    // largest font setting this row is wider than the display, and without this
    // it was simply clipped at both ends.
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  taglineChip: {
    ...typography.label,
    color: colors.textMuted,
  },
  taglineDot: {
    color: colors.textFaint,
    fontSize: 12,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  statSplit: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.xs,
    backgroundColor: colors.border,
  },
  statIcon: {
    fontSize: 15,
  },
  statValue: {
    fontSize: 21,
    fontWeight: '900',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  actions: {
    gap: spacing.md,
  },
  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.pinkSoft,
  },
  dailyCardDone: {
    borderColor: colors.border,
  },
  dailyText: {
    flex: 1,
    gap: 1,
  },
  dailyTitle: {
    ...typography.heading,
    color: colors.text,
  },
  dailyHint: {
    ...typography.label,
    color: colors.textMuted,
    fontWeight: '500',
  },
  streakTag: {
    backgroundColor: colors.pinkSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  streakTagText: {
    ...typography.label,
    color: colors.pink,
    fontWeight: '800',
  },
  chevron: {
    fontSize: 26,
    lineHeight: 28,
    color: colors.textFaint,
    fontWeight: '600',
  },
  // Pushes the secondary links to the bottom on tall screens without ever
  // clipping them on short ones, since the screen still scrolls.
  spacer: {
    flexGrow: 1,
    minHeight: spacing.xs,
  },
  footerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  footerText: {
    flex: 1,
    gap: 1,
  },
  footerLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  footerHint: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'none',
    letterSpacing: 0,
  },
});
