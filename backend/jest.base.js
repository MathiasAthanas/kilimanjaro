module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  clearMocks: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/generated/'],
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/generated/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/generated/**',
    '!src/**/*.module.ts',
  ],
};
