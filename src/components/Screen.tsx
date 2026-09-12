import { ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme/theme';

/**
 * Standard screen frame: safe-area aware, edge padding, optional scrolling.
 *
 * Insets come from the device rather than from constants, which is what keeps
 * the layout correct across notches, gesture bars and split-screen without any
 * hardcoded dimensions.
 */
export function Screen({
  children,
  scroll = false,
  style,
  contentStyle,
}: {
  children?: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + spacing.md,
    paddingBottom: insets.bottom + spacing.lg,
    paddingLeft: insets.left + spacing.lg,
    paddingRight: insets.right + spacing.lg,
  };

  if (scroll) {
    return (
      <ScrollView
        style={[styles.root, style]}
        contentContainerStyle={[padding, styles.scrollContent, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.root, padding, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
