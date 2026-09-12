import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { PressableScale } from './PressableScale';
import { colors, elevation, radii, spacing, typography } from '../theme/theme';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  return <View style={[styles.card, elevation('low'), style]}>{children}</View>;
}

export type ButtonTone = 'primary' | 'orange' | 'pink' | 'neutral' | 'ghost';

const TONE_BACKGROUND: Record<ButtonTone, string> = {
  primary: colors.primary,
  orange: colors.orange,
  pink: colors.pink,
  neutral: colors.surface,
  ghost: 'transparent',
};

const TONE_TEXT: Record<ButtonTone, string> = {
  primary: colors.white,
  orange: colors.white,
  pink: colors.white,
  neutral: colors.text,
  ghost: colors.textMuted,
};

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: ButtonTone;
  readonly size?: 'large' | 'medium' | 'small';
  readonly icon?: string;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly subtitle?: string;
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  size = 'medium',
  icon,
  disabled = false,
  style,
  subtitle,
}: ButtonProps): React.ReactElement {
  const height = size === 'large' ? 64 : size === 'medium' ? 52 : 42;
  const fontSize = size === 'large' ? 20 : size === 'medium' ? 16 : 14;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[
        styles.button,
        {
          minHeight: height,
          backgroundColor: TONE_BACKGROUND[tone],
          borderWidth: tone === 'neutral' ? 1 : 0,
        },
        tone !== 'ghost' && tone !== 'neutral' ? elevation('medium') : undefined,
        style,
      ]}
    >
      <View style={styles.buttonInner}>
        {icon !== undefined ? <Text style={[styles.buttonIcon, { fontSize }]}>{icon}</Text> : null}
        <View>
          <Text style={[styles.buttonLabel, { fontSize, color: TONE_TEXT[tone] }]}>{label}</Text>
          {subtitle !== undefined ? (
            <Text style={[styles.buttonSubtitle, { color: TONE_TEXT[tone] }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

export function StatPill({
  icon,
  value,
  label,
  tone = colors.primary,
}: {
  icon: string;
  value: string | number;
  label?: string;
  tone?: string;
}): React.ReactElement {
  return (
    <View style={[styles.pill, elevation('low')]}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <View>
        <Text style={[styles.pillValue, { color: tone }]}>{value}</Text>
        {label !== undefined ? <Text style={styles.pillLabel}>{label}</Text> : null}
      </View>
    </View>
  );
}

export function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}): React.ReactElement {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function ProgressBar({
  value,
  tone = colors.primary,
  height = 8,
}: {
  value: number;
  tone?: string;
  height?: number;
}): React.ReactElement {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: tone,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

/** Lives, drawn as hearts so the count reads at a glance. */
export function LifeRow({ lives, max = 3 }: { lives: number; max?: number }): React.ReactElement {
  const slots = Math.max(max, lives);
  return (
    <View style={styles.lifeRow} accessibilityLabel={`${lives} lives remaining`}>
      {Array.from({ length: slots }, (_unused, index) => (
        <Text key={index} style={[styles.life, index >= lives && styles.lifeSpent]}>
          {index < lives ? '♥' : '♡'}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  button: {
    borderRadius: radii.lg,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buttonIcon: {
    color: colors.white,
  },
  buttonLabel: {
    fontWeight: '800',
    textAlign: 'center',
  },
  buttonSubtitle: {
    ...typography.caption,
    opacity: 0.85,
    textAlign: 'center',
    marginTop: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pillIcon: {
    fontSize: 16,
  },
  pillValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  pillLabel: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  progressTrack: {
    backgroundColor: colors.border,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  lifeRow: {
    flexDirection: 'row',
    gap: 2,
  },
  life: {
    fontSize: 18,
    color: colors.pink,
  },
  lifeSpent: {
    color: colors.border,
  },
});
