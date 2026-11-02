/**
 * Jest configuration for the backend suite (Person 4 - Raghav).
 *
 * The code base uses native ES modules, so Jest runs with --experimental-vm-modules
 * (see the "test:backend" script) and no Babel transform.
 * Tests share one PostgreSQL database, so they run one file at a time.
 */
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['<rootDir>/tests/backend/**/*.test.js'],
  globalSetup: '<rootDir>/tests/backend/helpers/global-setup.js',
  maxWorkers: 1,
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/auth/**/*.js',
    'src/calendar/**/*.js',
    'src/db/**/*.js',
    'src/importer/**/*.js',
    'src/adaptive/**/*.js',
    'src/middleware/**/*.js',
    'src/notifications/**/*.js',
    'src/timetable/**/*.js',
    'src/validation/**/*.js',
    'src/repositories/*-repository.js'
  ]
};
