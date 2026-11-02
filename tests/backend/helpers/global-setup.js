import { prepareTestDatabase } from '../../support/test-database.js';

/**
 * Jest global setup: build the test database schema once, before any test file runs.
 */
export default async function globalSetup() {
  await prepareTestDatabase();
}
