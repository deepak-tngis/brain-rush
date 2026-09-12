/**
 * Two test projects with very different needs:
 *
 *  - `engine` runs the pure game logic, persistence and ad-policy modules in a
 *    plain node environment. No native mocks, no React: fast and hermetic.
 *  - `ui` renders the actual screens through jest-expo, which is the closest
 *    thing to "it launches and every screen is navigable" that can be checked
 *    without a device.
 */
const transform = {
  '^.+\\.tsx?$': [
    'ts-jest',
    {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        jsx: 'react-jsx',
        target: 'ES2021',
        module: 'CommonJS',
      },
    },
  ],
};

module.exports = {
  projects: [
    {
      displayName: 'engine',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: [
        '<rootDir>/src/engine/**/__tests__/**/*.test.ts',
        '<rootDir>/src/ads/**/__tests__/**/*.test.ts',
        '<rootDir>/src/storage/**/__tests__/**/*.test.ts',
      ],
      transform,
      moduleNameMapper: {
        // The persistence layer is exercised against an in-memory key/value
        // store; nothing else under test touches a native module.
        '^@react-native-async-storage/async-storage$':
          '<rootDir>/src/testing/asyncStorageMock.ts',
      },
    },
    {
      displayName: 'ui',
      preset: 'jest-expo',
      roots: ['<rootDir>/src/testing'],
      testMatch: ['<rootDir>/src/testing/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/src/testing/setupUiTests.ts'],
    },
  ],
  collectCoverageFrom: [
    'src/engine/**/*.ts',
    'src/ads/interstitialPolicy.ts',
    'src/storage/**/*.ts',
  ],
};
