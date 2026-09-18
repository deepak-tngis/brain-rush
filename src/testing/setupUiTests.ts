/**
 * Native modules the screens touch, stubbed just enough to render.
 *
 * Each stub mirrors the *contract* the app relies on rather than the module's
 * full surface — in particular `showRewardedAd` resolves to "not granted" by
 * default, so a test that forgets to opt in can never accidentally assert that
 * rewards are handed out for free.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  preload: jest.fn().mockResolvedValue(undefined),
  // A fresh player each call, so the effects and the music bed cannot end up
  // sharing one object and masking a bug where they do on device.
  createAudioPlayer: jest.fn(() => ({
    volume: 1,
    loop: false,
    isLoaded: true,
    currentTime: 0,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    remove: jest.fn(),
  })),
}));

// A gradient is a native view with no behaviour the screens depend on, so a
// plain View stands in for it and layout still resolves exactly as on device.
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: require('react-native').View,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn().mockResolvedValue(undefined),
}));

// No ad SDK in the test environment: exactly the situation the app has to
// survive on a device without Play Services, or in airplane mode.
jest.mock('react-native-google-mobile-ads', () => {
  throw new Error('react-native-google-mobile-ads is unavailable');
});
