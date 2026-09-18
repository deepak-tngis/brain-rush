import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { adConfig } from '../src/ads/adConfig';
import {
  adsAvailable,
  initAds,
  privacyOptionsRequired,
  showPrivacyOptions,
} from '../src/ads/adManager';
import { playSound } from '../src/audio/soundManager';
import { EnterView } from '../src/components/Feedback';
import { PressableScale } from '../src/components/PressableScale';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { VolumeSlider } from '../src/components/VolumeSlider';
import { Card, Divider, IconBadge, SectionTitle } from '../src/components/ui';
import { useAndroidBack } from '../src/hooks/useAndroidBack';
import { resetProgress } from '../src/storage/progressStore';
import { setSetting, useProgress } from '../src/state/ProgressProvider';
import { colors, elevation, radii, spacing, typography } from '../src/theme/theme';

export default function SettingsScreen(): React.ReactElement {
  const router = useRouter();
  const progress = useProgress();

  const goBack = useCallback(() => {
    router.back();
    return true;
  }, [router]);

  useAndroidBack(goBack);

  /**
   * Whether to offer the consent form again.
   *
   * Only the UMP SDK knows whether this user was ever shown one, and it only
   * knows after `initAds` has gathered consent — which may still be in flight
   * when Settings opens, so this is read once that has settled rather than at
   * first render.
   */
  const [showPrivacyRow, setShowPrivacyRow] = useState(privacyOptionsRequired);

  useEffect(() => {
    let active = true;
    void initAds().then(() => {
      if (active) setShowPrivacyRow(privacyOptionsRequired());
    });
    return () => {
      active = false;
    };
  }, []);

  const openPrivacyOptions = useCallback(() => {
    void showPrivacyOptions().then((opened) => {
      if (!opened) {
        Alert.alert(
          'Not available',
          'The advert privacy form could not be opened. Check your connection and try again.',
        );
      }
    });
  }, []);

  const confirmReset = useCallback(() => {
    Alert.alert(
      'Reset everything?',
      'Coins, scores, streaks and statistics will all go back to the start. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void resetProgress();
          },
        },
      ],
    );
  }, []);

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = Constants.expoConfig?.android?.versionCode ?? 1;

  return (
    <Screen scroll contentStyle={styles.content}>
      <ScreenHeader title="Settings" subtitle="Feedback, adverts and data" onBack={goBack} />

      <EnterView>
        <Card style={styles.card}>
          <SectionTitle>Feedback</SectionTitle>
          <Row
            icon={'\u{1F50A}'}
            tint={colors.primarySoft}
            label="Sound effects"
            hint="Chimes, buzzes and coin blips"
            value={progress.settings.soundEnabled}
            onChange={(value) => {
              setSetting('soundEnabled', value);
              // Play the confirmation *after* enabling so the change is audible.
              if (value) setTimeout(() => playSound('correct'), 60);
            }}
          />
          <Divider />
          <Row
            icon={'\u{1F4F3}'}
            tint={colors.purpleSoft}
            label="Vibration"
            hint="A short tap on every answer"
            value={progress.settings.hapticsEnabled}
            onChange={(value) => setSetting('hapticsEnabled', value)}
          />
          <Divider />
          <Row
            icon={'\u{1F3B5}'}
            tint={colors.pinkSoft}
            label="Background music"
            hint="A soft loop behind the puzzles"
            value={progress.settings.musicEnabled}
            onChange={(value) => setSetting('musicEnabled', value)}
          />
          <View style={styles.sliderRow}>
            <VolumeSlider
              value={progress.settings.musicVolume}
              onChange={(value) => setSetting('musicVolume', value)}
              disabled={!progress.settings.musicEnabled}
              accessibilityLabel="Music volume"
            />
          </View>
        </Card>
      </EnterView>

      <EnterView delay={70}>
        <Card style={styles.card}>
          <SectionTitle>Adverts</SectionTitle>
          <Row
            icon={'\u{1F3AF}'}
            tint={colors.orangeSoft}
            label="Personalised adverts"
            hint="Off means adverts are non-personalised"
            value={progress.settings.personalisedAds}
            onChange={(value) => setSetting('personalisedAds', value)}
          />
          {/* Google requires a way back into the consent form for any user who
              was shown one, so this appears only where that applies — which is
              also the only place the form would open. */}
          {showPrivacyRow ? (
            <>
              <Divider />
              <PressableScale
                onPress={openPrivacyOptions}
                accessibilityLabel="Advert privacy choices"
                style={styles.privacyRow}
                pressedScale={0.98}
              >
                <IconBadge icon={'\u{1F6E1}'} tint={colors.primarySoft} size={38} />
                <View style={styles.privacyText}>
                  <Text style={styles.privacyLabel}>Advert privacy choices</Text>
                  <Text style={styles.privacyHint}>Review or change your consent</Text>
                </View>
                <Text style={styles.privacyChevron}>{'›'}</Text>
              </PressableScale>
            </>
          ) : null}
          <View style={styles.note}>
            <Text style={styles.noteText}>
              {adsAvailable()
                ? adConfig.useTestIds
                  ? 'Running with Google test adverts.'
                  : 'Running with production advert units.'
                : 'Adverts are unavailable in this build. Everything else works exactly the same.'}
            </Text>
            <Text style={styles.noteText}>Rewards are identical either way.</Text>
          </View>
        </Card>
      </EnterView>

      <EnterView delay={140}>
        <Card style={styles.card}>
          <SectionTitle>About</SectionTitle>
          <View style={styles.aboutRow}>
            <IconBadge icon={'\u{2708}\u{FE0F}'} tint={colors.primarySoft} />
            <Text style={styles.about}>
              Brain Rush plays entirely offline. Puzzles are generated on your device, progress is
              saved on your device, and there is no account to create. Only adverts need a
              connection.
            </Text>
          </View>
          <View style={styles.meta}>
            <MetaRow label="Version" value={`${version} (${build})`} />
            <MetaRow label="Package" value="com.vantyralabs.brainrush" />
          </View>
        </Card>
      </EnterView>

      <EnterView delay={210}>
        <PressableScale
          onPress={confirmReset}
          accessibilityLabel="Reset all progress"
          style={[styles.danger, elevation('low')]}
          pressedScale={0.98}
        >
          <IconBadge icon={'\u{1F5D1}'} tint={colors.dangerSoft} size={38} />
          <View style={styles.dangerText}>
            <Text style={styles.dangerLabel}>Reset all progress</Text>
            <Text style={styles.dangerHint}>Coins, scores and statistics. Cannot be undone.</Text>
          </View>
        </PressableScale>
      </EnterView>
    </Screen>
  );
}

function Row({
  icon,
  tint,
  label,
  hint,
  value,
  onChange,
}: {
  icon: string;
  tint: string;
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <IconBadge icon={icon} tint={tint} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
        accessibilityLabel={label}
      />
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  card: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  rowHint: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
  },
  // Indented to sit under the music row's text rather than its icon, so the
  // slider reads as belonging to that switch.
  sliderRow: {
    paddingLeft: 40 + spacing.md,
    paddingBottom: spacing.xs,
  },
  note: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    gap: 2,
  },
  noteText: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'none',
    letterSpacing: 0,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  about: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
  },
  meta: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  metaValue: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    flexShrink: 1,
    textAlign: 'right',
  },
  danger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    padding: spacing.md,
  },
  dangerText: {
    flex: 1,
    gap: 1,
  },
  dangerLabel: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '800',
  },
  dangerHint: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'none',
    letterSpacing: 0,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  privacyText: {
    flex: 1,
    gap: 1,
  },
  privacyLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  privacyHint: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'none',
    letterSpacing: 0,
  },
  privacyChevron: {
    fontSize: 26,
    lineHeight: 28,
    color: colors.textFaint,
    fontWeight: '600',
  },
});
