import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { createTestContext } from './helpers/test-context.js';
import { buildConflictFreeEntries, insertSection } from './helpers/timetable-fixtures.js';

const VIRTUAL_USERS = 100;
const REQUESTS_PER_USER = 3;
const MAX_P95_MS = 500;

/**
 * Return a percentile from a list of durations.
 *
 * @param {number[]} values Durations in milliseconds.
 * @param {number} percentile Percentile between 0 and 100.
 * @returns {number}
 */
function percentile(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

describe('Performance under concurrent load', () => {
  let context;
  let server;
  let baseUrl;
  let token;

  beforeAll(async () => {
    context = await createTestContext({ env: { AUTH_CACHE_MS: '1000' } });
    await insertSection(context.pool, 'CSE5');
    await context.services.timetableService.saveVersion(
      { name: 'Load test timetable', entries: buildConflictFreeEntries(30) },
      { name: 'Load Admin' }
    );
    ({ token } = await context.createUser({ role: 'STUDENT', sectionId: 'CSE5' }));

    await new Promise((resolve) => {
      server = context.app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Warm-up: open the pooled database connections and prime the query paths, so the measured
    // burst reflects steady-state latency rather than one-off connection set-up.
    await Promise.all(
      Array.from({ length: 40 }, () =>
        fetch(`${baseUrl}/api/timetables?section=CSE5`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.text())
      )
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await context.close();
  });

  /**
   * Simulate one user calling the timetable endpoint several times in a row.
   *
   * @returns {Promise<{ durations: number[], failures: number }>}
   */
  async function runVirtualUser() {
    const durations = [];
    let failures = 0;

    for (let call = 0; call < REQUESTS_PER_USER; call += 1) {
      const startedAt = performance.now();
      try {
        const response = await fetch(`${baseUrl}/api/timetables?section=CSE5`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await response.json();
        if (!response.ok) failures += 1;
      } catch {
        failures += 1;
      }
      durations.push(performance.now() - startedAt);
    }

    return { durations, failures };
  }

  test('TC20 - 100 concurrent users keep p95 latency under 500 ms with an error rate under 1%', async () => {
    const results = await Promise.all(Array.from({ length: VIRTUAL_USERS }, runVirtualUser));

    const durations = results.flatMap((result) => result.durations);
    const failures = results.reduce((total, result) => total + result.failures, 0);

    expect(durations).toHaveLength(VIRTUAL_USERS * REQUESTS_PER_USER);
    expect(percentile(durations, 95)).toBeLessThan(MAX_P95_MS);
    expect(failures / durations.length).toBeLessThan(0.01);
  });

  test('TC20 - the health endpoint reports the API and database as UP', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: 'UP', api: 'UP', database: 'UP' });
  });

  test('the health endpoint reports 503 and database DOWN when the database is unreachable', async () => {
    const unreachableDatabase = { $queryRaw: () => Promise.reject(new Error('connection refused')) };
    const { createHealthRoutes } = await import('../../src/routes/health-routes.js');
    const { default: express } = await import('express');
    const app = express().use('/api/health', createHealthRoutes({ prisma: unreachableDatabase }));
    const down = await new Promise((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });

    const response = await fetch(`http://127.0.0.1:${down.address().port}/api/health`);
    down.close();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: 'DOWN', api: 'UP', database: 'DOWN' });
  });
});
