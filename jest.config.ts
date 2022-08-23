export default {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  preset: 'ts-jest',
  coveragePathIgnorePatterns: ['node_modules/', 'tests/'],
  roots: ['<rootDir>/src/', '<rootDir>/tests/'],
  transformIgnorePatterns: ['<rootDir>/tests/integration'],
  testMatch: ['**/tests/unit/**/*.test.ts'],
  testEnvironment: 'node'
};
