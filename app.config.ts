import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Google's official AdMob *test* identifiers.
 * They are safe to ship in source control and always fill, even offline-ish
 * emulators, which keeps development from ever touching production inventory.
 */
const TEST_ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

/**
 * Production identifiers are supplied purely through the environment so that
 * shipping a real build never requires touching game logic:
 *
 *   ADMOB_APP_ID=ca-app-pub-xxx~yyy \
 *   ADMOB_INTERSTITIAL_ID=ca-app-pub-xxx/yyy \
 *   ADMOB_REWARDED_ID=ca-app-pub-xxx/yyy \
 *   ADS_USE_TEST_IDS=false \
 *   npx expo prebuild --platform android
 */
const useTestIds = process.env.ADS_USE_TEST_IDS !== 'false';

const admobAppId = (!useTestIds && process.env.ADMOB_APP_ID) || TEST_ADMOB_APP_ID;
const interstitialId =
  (!useTestIds && process.env.ADMOB_INTERSTITIAL_ID) || TEST_INTERSTITIAL_ID;
const rewardedId = (!useTestIds && process.env.ADMOB_REWARDED_ID) || TEST_REWARDED_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Brain Rush',
  slug: 'brain-rush',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'brainrush',
  userInterfaceStyle: 'light',
  backgroundColor: '#f0f0f3',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'com.vantyralabs.brainrush',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#2f80ed',
    },
    predictiveBackGestureEnabled: false,
    // The game is fully offline; INTERNET is only needed so ad requests can be
    // attempted. Everything degrades gracefully when it is unavailable.
    permissions: ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'],
    /**
     * expo-av declares the full audio/video permission set, but Brain Rush only
     * ever plays seven bundled sound effects. Everything it does not use is
     * stripped so the Play listing asks for nothing it cannot justify, and the
     * advertising ID is dropped in favour of non-personalised requests.
     */
    blockedPermissions: [
      'com.google.android.gms.permission.AD_ID',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  ios: {
    bundleIdentifier: 'com.vantyralabs.brainrush',
    buildNumber: '1',
    supportsTablet: true,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#f0f0f3',
      },
    ],
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: admobAppId,
        iosAppId: admobAppId,
        // Defer AppMeasurement/ad SDK work off the critical launch path so the
        // first puzzle is interactive as quickly as possible.
        delayAppMeasurementInit: true,
        optimizeInitialization: true,
        optimizeAdLoading: true,
      },
    ],
  ],
  extra: {
    ads: {
      useTestIds,
      appId: admobAppId,
      interstitialId,
      rewardedId,
    },
  },
});
