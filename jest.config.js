/**
 * The game engine is deliberately free of React Native imports, so it can be
 * unit-tested with a plain ts-jest node environment: fast, hermetic and with no
 * native mocks to keep in sync.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/engine/**/*.ts', 'src/ads/interstitialPolicy.ts', 'src/storage/**/*.ts'],
  moduleNameMapper: {
    // The persistence layer is exercised against an in-memory key/value store;
    // everything else under test is free of native dependencies.
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/testing/asyncStorageMock.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { strict: true, esModuleInterop: true, target: 'ES2021', module: 'CommonJS' } },
    ],
  },
};
