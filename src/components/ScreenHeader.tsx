import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { PressableScale } from './PressableScale';
import { colors, elevation, radii, spacing, typography } from '../theme/theme';

/**
 * The header every secondary screen wears: a round back button pinned to the
 * left edge with the title set beside it.
 *
 * Before this existed each screen stacked a full-width ghost `Button` above its
 * title, which centred the word "Back" in the middle of the screen — floating,
 * unaligned with anything, and nothing like a back affordance. A fixed-size
 * circular target on the leading edge is what Android users reach for, and
 * putting the title on the same row ties the two together instead of leaving
 * the button orphaned on a line of its own.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Optional trailing control; the layout reserves its space either way. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  return (
    <View style={[styles.header, style]}>
      <PressableScale
        onPress={onBack}
        accessibilityLabel="Back"
        style={[styles.back, elevation('low')]}
        pressedScale={0.9}
      >
        <Text style={styles.backIcon}>{'←'}</Text>
      </PressableScale>

      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Balances the row so the title never shifts as trailing content
          appears or disappears between screens. */}
      <View style={styles.trailing}>{right}</View>
    </View>
  );
}

const BACK_SIZE = 44;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  back: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
  },
  titles: {
    flex: 1,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: 1,
  },
  trailing: {
    minWidth: BACK_SIZE,
    alignItems: 'flex-end',
  },
});
