import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { adConfig } from '../src/ads/adConfig';
import { adsAvailable } from '../src/ads/adManager';
import { playSound } from '../src/audio/soundManager';
import { Screen } from '../src/components/Screen';
import { Button, Card, SectionTitle } from '../src/components/ui';
import { useAndroidBack } from '../src/hooks/useAndroidBack';
import { resetProgress } from '../src/storage/progressStore';
import { setSetting, useProgress } from '../src/state/ProgressProvider';
import { colors, radii, spacing, typography } from '../src/theme/theme';

export default function SettingsScreen(): React.ReactElement {
  const router = useRouter();
  const progress = useProgress();

  const goBack = useCallback(() => {
    router.back();
    return true;
  }, [router]);

  useAndroidBack(goBack);

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

  return (
    <Screen scroll contentStyle={styles.content}>
      <View>
        <Button label={'←  Back'} onPress={goBack} tone="ghost" size="small" />
      </View>

      <Text style={styles.title}>Settings</Text>

      <Card>
        <SectionTitle>Feedback</SectionTitle>
        <Row
          label="Sound effects"
          hint="Chimes, buzzes and coin blips"
          value={progress.settings.soundEnabled}
          onChange={(value) => {
            setSetting('soundEnabled', value);
            // Play the confirmation *after* enabling so the change is audible.
            if (value) setTimeout(() => playSound('correct'), 60);
          }}
        />
        <Row
          label="Vibration"
          hint="A short tap on every answer"
          value={progress.settings.hapticsEnabled}
          onChange={(value) => setSetting('hapticsEnabled', value)}
        />
      </Card>

      <Card>
        <SectionTitle>Adverts</SectionTitle>
        <Row
          label="Personalised adverts"
          hint="Off means adverts are non-personalised. Rewards are identical either way."
          value={progress.settings.personalisedAds}
          onChange={(value) => setSetting('personalisedAds', value)}
        />
        <Text style={styles.note}>
          {adsAvailable()
            ? adConfig.useTestIds
              ? 'Running with Google test adverts.'
              : 'Running with production advert units.'
            : 'Adverts are unavailable in this build. Everything else works exactly the same.'}
        </Text>
      </Card>

      <Card>
        <SectionTitle>About</SectionTitle>
        <Text style={styles.about}>
          Brain Rush plays entirely offline. Puzzles are generated on your device, progress is saved
          on your device, and there is no account to create. Only adverts need a connection.
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            Version {Constants.expoConfig?.version ?? '1.0.0'} ({
              Constants.expoConfig?.android?.versionCode ?? 1
            })
          </Text>
          <Text style={styles.metaText}>com.vantyralabs.brainrush</Text>
        </View>
      </Card>

      <Button label="Reset all progress" onPress={confirmReset} tone="neutral" icon={'⚠'} />
    </Screen>
  );
}

function Row({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}): React.ReactElement {
  return (
    <View style={styles.row}>
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

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  note: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'none',
    letterSpacing: 0,
    marginTop: spacing.sm,
  },
  about: {
    ...typography.body,
    color: colors.textMuted,
  },
  meta: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    gap: 2,
  },
  metaText: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'none',
    letterSpacing: 0,
  },
});
