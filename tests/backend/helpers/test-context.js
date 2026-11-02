import request from 'supertest';
import { loadConfig } from '../../../src/config/config.js';
import { createDatabase } from '../../../src/db/database.js';
import { seedTimeSlots } from '../../../src/db/seed.js';
import { createServices } from '../../../src/container.js';
import { createApp } from '../../../src/app.js';
import { generateId } from '../../../src/utils/id-generator.js';
import { seedFixtureData } from '../../support/fixtures.js';
import { TEST_DATABASE_URL, truncateAllTables } from '../../support/test-database.js';

export { TEST_DATABASE_URL };

export const STRONG_PASSWORD = 'Str0ngPassw0rd!';

/**
 * Start a clean application against the isolated test database.
 * Every table is emptied and the fixture data is stored again, so every test file starts equal.
 *
 * @param {{ overrides?: { googleClient?: object, clock?: () => Date }, env?: Record<string, string>, withEntries?: boolean }} [options] Test doubles, extra environment values and fixture options.
 * @returns {Promise<object>} Context with the database, services, express app and helper methods.
 */
export async function createTestContext({ overrides, env = {}, withEntries = false } = {}) {
  const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret', ...env });
  const database = createDatabase({ connectionString: TEST_DATABASE_URL, log: [] });
  const { prisma, pool } = database;

  await truncateAllTables(pool);
  await seedTimeSlots(prisma);
  await seedFixtureData(prisma, { withEntries });

  const services = createServices({ prisma, config, overrides });
  const silentLogger = { error: () => {} };
  const app = createApp({ services, config, logger: silentLogger });

  return {
    prisma,
    pool,
    config,
    services,
    app,
    http: () => request(app),
    close: () => database.close(),

    /**
     * Insert a user directly and return it together with a ready-to-use access token.
     *
     * @param {{ role?: string, email?: string, sectionId?: string, facultyId?: string, password?: string }} [fields] User fields.
     * @returns {Promise<{ user: object, token: string, password: string }>}
     */
    async createUser({ role = 'STUDENT', email, sectionId, facultyId, password = STRONG_PASSWORD } = {}) {
      const passwordHash = await services.passwordService.hash(password);
      const user = await services.userRepository.create({
        id: generateId('USR'),
        name: `Test ${role}`,
        email: email || `${generateId('user')}@timora.edu`.toLowerCase(),
        passwordHash,
        role,
        sectionId,
        facultyId
      });
      return { user, password, token: services.tokenService.issue(user) };
    }
  };
}

/**
 * Build the Authorization header for a token.
 *
 * @param {string} token Access token.
 * @returns {{ Authorization: string }}
 */
export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}
