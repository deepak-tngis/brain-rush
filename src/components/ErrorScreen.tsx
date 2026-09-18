import type { ErrorBoundaryProps } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './ui';
import { colors, radii, spacing, typography } from '../theme/theme';

/**
 * What the player sees if something throws during render.
 *
 * Without a boundary, one unexpected exception unmounts the whole tree and a
 * release build simply goes blank — no message, no way back, and nothing the
 * player can do but force-quit. This catches it and offers the one action that
 * actually helps: try again. Retrying re-renders the route rather than
 * restarting the process, and the save file is untouched, so a player who hits
 * this keeps their coins and streak.
 *
 * The technical detail is shown only in development. A stack trace tells a
 * player nothing and reads like the app has broken more badly than it has.
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const onRetry = useCallback(() => {
    void retry();
  }, [retry]);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.emoji}>{'\u{1F635}'}</Text>
        <Text style={styles.title}>That puzzle broke us</Text>
        <Text style={styles.body}>
          Something went wrong and Brain Rush had to stop what it was doing. Your coins, streak
          and statistics are all safe.
        </Text>

        {__DEV__ ? (
          <View style={styles.details}>
            <Text style={styles.detailsLabel}>Development detail</Text>
            <Text style={styles.detailsText}>{error.message}</Text>
          </View>
        ) : null}

        <Button label="Try again" onPress={onRetry} tone="primary" size="large" icon={'↻'} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 56,
    textAlign: 'center',
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  details: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  detailsLabel: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
  },
  detailsText: {
    ...typography.caption,
    color: colors.danger,
    textTransform: 'none',
    letterSpacing: 0,
  },
});
