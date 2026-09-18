import type { ConfigContext, ExpoConfig } from 'expo/config';

import withGradleMemory from './plugins/withGradleMemory';
import withKotlinVersion from './plugins/withKotlinVersion';
import withUploadSigning from './plugins/withUploadSigning';

/**
 * Release builds run `lintVital`, whose Kotlin analysis exhausts the 512m
 * metaspace Expo's template ships with. See plugins/withGradleMemory.js.
 */
const GRADLE_JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=2048m';

/**
 * play-services-ads (pulled in by react-native-google-mobile-ads) is compiled
 * with this Kotlin release by Google; the Android build has to be able to read
 * metadata in that format. See plugins/withKotlinVersion.js for why
 * expo-build-properties' android.kotlinVersion doesn't cover this on its own.
 */
const ANDROID_KOTLIN_VERSION = '2.3.0';

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
    // Play refuses a versionCode it has already seen, including one sitting in
    // an unreleased draft, so this rises with every uploaded bundle.
    versionCode: 2,
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
     * expo-audio only declares MODIFY_AUDIO_SETTINGS, but some transitive
     * dependency previously pulled in a broader set. Blocking these keeps the
     * Play listing asking for nothing the app cannot justify.
     *
     * The advertising-ID permissions are deliberately NOT blocked. They are
     * what play-services-ads needs to read the advertising identifier, without
     * which Android 13+ zeroes it out and every request is served as
     * non-personalised — which is a large cut in revenue, and which Play flags
     * as a mismatch against the "uses advertising ID" declaration.
     *
     * Serving personalised adverts is what obliges the app to gather consent
     * through the Google UMP SDK before its first request; see
     * src/ads/adManager.ts.
     */
    blockedPermissions: [
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
        // Matches the brand gradient the animated intro opens on, so the
        // handover from this static image to `IntroSequence` is a continuation
        // rather than a flash from light to dark. The app's own light
        // background takes over when the intro fades out.
        backgroundColor: '#2f80ed',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          // Aligns Expo's own native modules (compiled via
          // expo-module-gradle-plugin) to the same Kotlin release as the rest of
          // the app. This alone does NOT fix the google-mobile-ads/Kotlin
          // mismatch below — see plugins/withKotlinVersion.js for why.
          kotlinVersion: ANDROID_KOTLIN_VERSION,

          /**
           * R8 for release builds: shrink, optimise and obfuscate the Java and
           * Kotlin side, and drop unreferenced resources.
           *
           * Safe for the audio because React Native generates a `keep.xml`
           * naming every bundled asset — including all eight sound files — so
           * the resource shrinker cannot strip things only the JS bundle knows
           * about.
           *
           * Most of what needs surviving is already covered: expo-modules-core
           * and expo both ship `consumerProguardFiles`, so their reflective
           * module-registry rules apply automatically, and Google does the same
           * for play-services-ads.
           */
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          extraProguardRules: [
            '# The JNI layer is entered from native code, so nothing in the Java',
            '# graph appears to reference it.',
            '-keep class com.facebook.jni.** { *; }',
            '-keep @com.facebook.proguard.annotations.DoNotStrip class *',
            '-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }',
            '',
            '# The AdMob bridge: Google ships rules for the SDK underneath, but',
            '# not for this wrapper, which the ad SDK calls back into.',
            '-keep class io.invertase.googlemobileads.** { *; }',
            '',
            '# The UMP consent SDK. Required by react-native-google-mobile-ads:',
            '# without it R8 strips the consent form internals and gathering',
            '# consent fails at runtime — in release builds only.',
            '-keep class com.google.android.gms.internal.consent_sdk.** { *; }',
          ].join('\n'),
        },
      },
    ],
    // react-native-google-mobile-ads pulls in play-services-ads, which Google
    // compiles with whatever Kotlin release is current — currently newer than
    // the 2.1.20 React Native's own gradle-plugin pins for the root buildscript
    // classpath. Without this, compileReleaseKotlin fails with "Module was
    // compiled with an incompatible version of Kotlin".
    // ExpoConfig['plugins'] is typed as string identifiers only, but the
    // resolver also accepts a plugin function directly — this is a real,
    // supported path, just not one the .d.ts reflects.
    [withKotlinVersion, { kotlinVersion: ANDROID_KOTLIN_VERSION }] as unknown as [string, unknown],
    [withGradleMemory, { jvmArgs: GRADLE_JVM_ARGS }] as unknown as [string, unknown],
    // Release builds are signed with the Play upload key, not the debug key the
    // Expo template defaults to. Credentials stay in the gitignored
    // credentials/ directory and are read at Gradle time.
    withUploadSigning as unknown as string,
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
    eas: {
      projectId: '982bcd47-e4e8-451d-95c2-498d8c4bb6c4',
    },
  },
  owner: 'deepakp.tngis',
});
