const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Raises the memory ceiling for the Gradle daemon.
 *
 * Expo's generated `android/gradle.properties` ships
 * `-Xmx2048m -XX:MaxMetaspaceSize=512m`. That is enough for a debug build, but a
 * *release* build additionally runs `lintVital`, whose Kotlin (K2) analysis
 * loads a large amount of class metadata — and with `org.gradle.parallel=true`
 * several module lint workers run at once, all drawing on the same metaspace.
 * At 512m they exhaust it, and the build dies with a bare `OutOfMemoryError:
 * Metaspace` from inside the lint worker, which reads like a lint bug rather
 * than a memory setting.
 *
 * Applied as a config plugin rather than by hand because `expo prebuild`
 * regenerates `android/` from scratch and would silently drop the edit.
 */
const withGradleMemory = (config, { jvmArgs }) =>
  withGradleProperties(config, (config) => {
    const key = 'org.gradle.jvmargs';
    const existing = config.modResults.find(
      (item) => item.type === 'property' && item.key === key,
    );

    if (existing !== undefined) {
      existing.value = jvmArgs;
    } else {
      config.modResults.push({ type: 'property', key, value: jvmArgs });
    }

    return config;
  });

module.exports = withGradleMemory;
