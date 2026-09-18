const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Forces the root Android buildscript's Kotlin Gradle Plugin version.
 *
 * react-native-google-mobile-ads pulls in play-services-ads, which Google
 * compiles with whatever Kotlin release is current when they cut it. Expo SDK
 * 57 / React Native's own gradle-plugin pins Kotlin 2.1.20 via a Gradle version
 * catalog bundled inside `@react-native/gradle-plugin` (an `includeBuild`), and
 * the root `android/build.gradle` requests
 * `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')` with NO version —
 * so it inherits whatever version React Native's plugin transitively pins.
 *
 * `expo-build-properties`'s `android.kotlinVersion` does NOT affect this: that
 * property is only read by Expo's own `expo-module-gradle-plugin`, for
 * Expo-authored native modules. It has no effect on the root buildscript
 * classpath, so a third-party module like google-mobile-ads never sees it.
 *
 * The fix here is a plain Gradle "highest version wins" trick: give the root
 * classpath dependency an explicit version. An explicit request beats a
 * transitively-requested lower one, so this wins over React Native's 2.1.20
 * without needing to touch react-native's own files.
 */
const withKotlinVersion = (config, { kotlinVersion }) =>
  withProjectBuildGradle(config, (config) => {
    const versionless = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')";
    const pinned = `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}')`;

    if (config.modResults.contents.includes(versionless)) {
      config.modResults.contents = config.modResults.contents.replace(versionless, pinned);
    } else if (!config.modResults.contents.includes(pinned)) {
      throw new Error(
        `withKotlinVersion: could not find the Kotlin Gradle Plugin classpath line to patch. ` +
          `The generated android/build.gradle template may have changed — update plugins/withKotlinVersion.js.`,
      );
    }

    return config;
  });

module.exports = withKotlinVersion;
