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
  collectCoverageFrom: ['src/engine/**/*.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { strict: true, esModuleInterop: true, target: 'ES2021', module: 'CommonJS' } },
    ],
  },
};
