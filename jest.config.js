module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/test_*.js'],
  collectCoverageFrom: [
    'static/**/*.js',
    '!static/chart.umd.min.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
  testTimeout: 10000,
  // Enable ES modules support
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/'
  ],
  moduleFileExtensions: ['js', 'json'],
  testPathIgnorePatterns: ['/node_modules/']
};
