import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { PressableScale } from './PressableScale';
import { colors, elevation, gradients, radii, spacing, typography } from '../theme/theme';

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

/**
 * Tones that fill with a gradient instead of a flat colour. The flat value in
 * `TONE_BACKGROUND` stays as the base, so the button is still the right colour
 * for the single frame before the gradient paints.
 */
const TONE_GRADIENT: Partial<Record<ButtonTone, readonly [string, string]>> = {
  primary: gradients.primary,
  pink: gradients.pink,
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
  const gradient = TONE_GRADIENT[tone];

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
      {gradient !== undefined ? (
        <LinearGradient
          colors={[...gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={styles.buttonInner}>
        {icon !== undefined ? (
          <Text style={[styles.buttonIcon, { fontSize, color: TONE_TEXT[tone] }]}>{icon}</Text>
        ) : null}
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

/**
 * A rounded square holding one glyph, tinted to match whatever it labels. Gives
 * list rows a fixed leading column so their text aligns down the screen.
 */
export function IconBadge({
  icon,
  tint,
  size = 40,
}: {
  icon: string;
  tint: string;
  size?: number;
}): React.ReactElement {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 3, backgroundColor: tint },
      ]}
    >
      <Text style={{ fontSize: size * 0.45 }}>{icon}</Text>
    </View>
  );
}

/** Hairline between stacked rows inside a single card. */
export function Divider(): React.ReactElement {
  return <View style={styles.divider} />;
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
    // Clips the gradient fill to the rounded corners.
    overflow: 'hidden',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buttonIcon: {
    fontWeight: '700',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
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
