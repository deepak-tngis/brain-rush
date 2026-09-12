import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';

import { initAds } from '../src/ads/adManager';
import { GameProvider } from '../src/state/GameProvider';
import { useProgressBootstrap } from '../src/state/ProgressProvider';
import { colors } from '../src/theme/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout(): React.ReactElement {
  const { ready } = useProgressBootstrap();

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

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
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
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
