import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';

import { initAds } from '../src/ads/adManager';
import { ErrorScreen } from '../src/components/ErrorScreen';
import { IntroSequence } from '../src/components/IntroSequence';
import { GameProvider } from '../src/state/GameProvider';
import { useProgressBootstrap } from '../src/state/ProgressProvider';
import { colors } from '../src/theme/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * expo-router renders a route's `ErrorBoundary` export in place of the route
 * when it throws. Exported from the root layout, it covers every screen.
 *
 * Without it, a single render-time exception unmounts the tree and a release
 * build goes silently blank — the worst possible failure, because the player
 * cannot tell whether the app is broken or just frozen.
 */
export { ErrorScreen as ErrorBoundary };

export default function RootLayout(): React.ReactElement {
  const { ready } = useProgressBootstrap();
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync().catch(() => undefined);
    // Ads warm up in the background and are never awaited: a slow or failed
    // initialisation must not hold up the first puzzle.
    void initAds();
  }, [ready]);

  // The stack mounts underneath the intro rather than after it, so the first
  // render of Home happens while the animation is still playing and the handover
  // lands on a screen that is already drawn.
  const showIntro = !introDone;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style={showIntro ? 'light' : 'dark'} />
        <GameProvider>
          {ready ? (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="game" />
              <Stack.Screen name="daily" />
              <Stack.Screen name="game-over" options={{ gestureEnabled: false }} />
              <Stack.Screen name="stats" />
              <Stack.Screen name="settings" />
            </Stack>
          ) : null}
          {showIntro ? <IntroSequence onDone={finishIntro} /> : null}
        </GameProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
