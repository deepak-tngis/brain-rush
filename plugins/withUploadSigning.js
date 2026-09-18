const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Signs release builds with the Play upload key instead of the debug key.
 *
 * Expo's template ships `release { signingConfig signingConfigs.debug }`, which
 * produces an artifact Play rejects — and rejects *late*, at upload, long after
 * the build looked successful. This rewrites that to a real signing config.
 *
 * Applied as a config plugin because `expo prebuild` regenerates `android/`
 * from scratch; a hand-edit to app/build.gradle survives exactly until the next
 * prebuild and then silently reverts to debug signing.
 *
 * The credentials are NOT written into the generated Gradle file. The snippet
 * below reads them at Gradle time from `credentials/keystore.properties`, which
 * is gitignored, so no password ever lands in a tracked or generated file. If
 * that file is missing the release packaging task fails on a null storeFile —
 * loudly, which is the point: a debug-signed release should never be the quiet
 * fallback.
 */

/** Loads the gitignored properties file. `rootProject` here is `android/`. */
const LOADER = `
// Injected by plugins/withUploadSigning.js — see that file for why.
def uploadProps = new Properties()
def uploadPropsFile = rootProject.file('../credentials/keystore.properties')
if (uploadPropsFile.exists()) {
    uploadPropsFile.withInputStream { uploadProps.load(it) }
}

`;

const UPLOAD_CONFIG = `    signingConfigs {
        upload {
            if (uploadProps['storeFile']) {
                storeFile rootProject.file(uploadProps['storeFile'])
                storePassword uploadProps['storePassword']
                keyAlias uploadProps['keyAlias']
                keyPassword uploadProps['keyPassword']
            }
        }
        debug {`;

/** Replacing a fixed string is only safe if it is actually there. */
const replaceOnce = (source, find, replace, what) => {
  const at = source.indexOf(find);
  if (at === -1) {
    throw new Error(
      `withUploadSigning: could not find ${what} in android/app/build.gradle. ` +
        'The Expo template has changed shape — update this plugin rather than ' +
        'shipping a build that may still be debug-signed.',
    );
  }
  if (source.indexOf(find, at + find.length) !== -1) {
    throw new Error(`withUploadSigning: ${what} matched more than once; refusing to guess.`);
  }
  return source.slice(0, at) + replace + source.slice(at + find.length);
};

const withUploadSigning = (config) =>
  withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withUploadSigning: expected a Groovy build.gradle');
    }

    let gradle = config.modResults.contents;

    gradle = replaceOnce(gradle, '\nandroid {\n', `\n${LOADER}android {\n`, 'the android block');

    gradle = replaceOnce(
      gradle,
      '    signingConfigs {\n        debug {',
      UPLOAD_CONFIG,
      'the signingConfigs block',
    );

    // Anchored on the template's own comment so it cannot match the *debug*
    // build type, which carries an identical `signingConfig` line.
    gradle = replaceOnce(
      gradle,
      '            // Caution! In production, you need to generate your own keystore file.\n' +
        '            // see https://reactnative.dev/docs/signed-apk-android.\n' +
        '            signingConfig signingConfigs.debug\n',
      '            signingConfig signingConfigs.upload\n',
      "the release build type's signing config",
    );

    config.modResults.contents = gradle;
    return config;
  });

module.exports = withUploadSigning;
