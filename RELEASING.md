# Releasing to Google Play

## The upload key

`credentials/upload-keystore.jks` — RSA 2048, alias `upload`, valid to 2054.
Its password is in `credentials/keystore.properties`. Both are gitignored.

**Back this directory up somewhere private, now.** Play ties the app listing to
this key's certificate. Lose it and you cannot publish an update without asking
Google to reset the upload key; leak it and someone else can push builds that
look like yours. A password manager entry plus an offline copy is enough — just
not this repository, and not anywhere the repository syncs to.

Nothing is locked in until the first upload, so if you would rather use a key of
your own, replace both files and rebuild; the alias and passwords are read from
`keystore.properties`, so nothing else has to change.

## How signing is wired

`plugins/withUploadSigning.js` rewrites the generated `android/app/build.gradle`
during `expo prebuild`:

- adds a `signingConfigs.upload` block that loads `credentials/keystore.properties`
  **at Gradle time**, so no password is ever written into a generated file;
- points the `release` build type at it, replacing Expo's default, which is the
  *debug* key.

That default is the trap this exists to close: it builds and installs happily and
is only rejected at upload, and because `prebuild` regenerates `android/` from
scratch, a hand-edit to fix it survives exactly until the next prebuild. The
plugin throws if the template's shape changes rather than letting a debug-signed
release through quietly.

## Building a bundle

Both variables are required — `prebuild` deletes `android/local.properties`, so
Gradle has no other way to find the SDK, and the default JVM on this machine is
too old for Gradle 9.

```powershell
$env:JAVA_HOME    = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

npx expo prebuild --platform android --no-install
cd android; .\gradlew.bat bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`.

Play wants the `.aab`. The `.apk` from `assembleRelease` is for sideloading and
on-device testing only.

## Ad configuration

`.env` (gitignored) holds the production AdMob IDs and `ADS_USE_TEST_IDS=false`.
Expo loads it automatically, but only `prebuild` copies the app ID into
`AndroidManifest.xml` — editing `.env` alone changes nothing in an existing
`android/` directory. After any change there, prebuild before you build, then
confirm:

```sh
unzip -p app-release.aab base/manifest/AndroidManifest.xml | grep -c <your-publisher-id>
```

## Crash reports

The R8 mapping and native debug symbols for all four ABIs ship inside the bundle
under `BUNDLE-METADATA/`, so Play deobfuscates and symbolicates crashes by
itself. There is no separate `mapping.txt` to upload.

## Before the first upload

- `versionCode` and `version` live in `app.config.ts`. Both must increase on
  every upload; Play rejects a `versionCode` it has already seen.
- The listing graphics are in `store/play/` — see `store/README.md`.
