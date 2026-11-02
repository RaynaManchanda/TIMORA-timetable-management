/**
 * Shared helper for the node:test suites that need the full application.
 * Starts the API on the isolated test database with the fixture data and three demo accounts
 * (coordinator, faculty member F101, student of section SEC_CSE_5A).
 */

import { loadConfig } from '../../src/config/config.js';
import { createDatabase } from '../../src/db/database.js';
import { seedTimeSlots } from '../../src/db/seed.js';
import { createServices } from '../../src/container.js';
import { createApp } from '../../src/app.js';
import { seedFixtureData } from './fixtures.js';
import { prepareTestDatabase, TEST_DATABASE_URL, truncateAllTables } from './test-database.js';

export const DEMO_PASSWORD = 'Password123!';

/**
 * Create the Express app on a freshly reset test database.
 * Requires the test database: run "npm run test:db:up" first.
 *
 * @returns {Promise<{ app: import('express').Express, services: object, prisma: object, close: () => Promise<void> }>}
 */
export async function createDemoApp() {
  // The schema is rebuilt from the Prisma migrations, exactly as in production.
  await prepareTestDatabase();

  const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret', BCRYPT_COST: '4' });
  const database = createDatabase({ connectionString: TEST_DATABASE_URL, log: [] });
  const { prisma, pool } = database;

  await truncateAllTables(pool);
  await seedTimeSlots(prisma);
  await seedFixtureData(prisma, { withEntries: true });

  const services = createServices({ prisma, config });
  const passwordHash = await services.passwordService.hash(DEMO_PASSWORD);
  const accounts = [
    { id: 'USR_ADMIN_01', name: 'Academic Coordinator', email: 'admin@timora.edu', role: 'COORDINATOR' },
    { id: 'USR_FAC_101', name: 'Dr. Alan Turing', email: 'turing@univ.edu', role: 'FACULTY', facultyId: 'F101' },
    { id: 'USR_STU_001', name: 'Student One', email: 'student@timora.edu', role: 'STUDENT', sectionId: 'SEC_CSE_5A' }
  ];
  for (const account of accounts) {
    await services.userRepository.createIfMissing({ ...account, passwordHash });
  }

  return {
    app: createApp({ services, config, logger: { error: () => {} } }),
    services,
    prisma,
    close: () => database.close()
  };
}
