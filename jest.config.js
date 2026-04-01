module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/test_*.js'],
  collectCoverageFrom: [
    'static/**/*.js',
    '!static/chart.umd.min.js',
    '!static/script.js'  // Exclude legacy script.js from coverage for now
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
  testTimeout: 10000,
  // Enable ES modules support
  transform: {
    '^.+\\.js$': ['babel-jest', { 
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*)/)'  // Transform all node_modules if needed
  ]
};
