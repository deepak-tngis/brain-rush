import { Modal, StyleSheet, Text, View } from 'react-native';

import { colors, elevation, radii, spacing, typography } from '../theme/theme';
import { Button } from './ui';

/**
 * The one place the player is offered a rewarded ad.
 *
 * Two things this deliberately does *not* do: block the game behind it (there is
 * always a "no thanks" that continues play), and promise a reward before the ad
 * has actually completed. The caller only applies the reward when the ad SDK
 * says it was earned.
 */
export interface RewardSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly declineLabel: string;
  readonly busy: boolean;
  /** Shown when an ad could not be served, so the player is never left guessing. */
  readonly error: string | null;
  onConfirm(): void;
  onDecline(): void;
}

export function RewardSheet({
  visible,
  title,
  message,
  confirmLabel,
  declineLabel,
  busy,
  error,
  onConfirm,
  onDecline,
}: RewardSheetProps): React.ReactElement {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android back closes the sheet rather than leaving the player stuck.
      onRequestClose={onDecline}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, elevation('high')]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {error !== null ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={busy ? 'Loading advert...' : confirmLabel}
            icon={busy ? undefined : '▶'}
            onPress={onConfirm}
            tone="orange"
            size="large"
            disabled={busy}
            style={styles.action}
          />
          <Button
            label={declineLabel}
            onPress={onDecline}
            tone="ghost"
            size="small"
            disabled={busy}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  error: {
    ...typography.label,
    color: colors.danger,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.sm,
  },
});
