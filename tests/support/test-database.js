/**
 * Helpers for the isolated PostgreSQL test database (docker-compose.test.yml, port 5433).
 * The schema is created by the very same Prisma migrations that production uses.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://timora_test:timora_test@localhost:5433/timora_test?schema=public';

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRISMA_CLI = path.join(PROJECT_ROOT, 'node_modules', 'prisma', 'build', 'index.js');

/**
 * Drop everything in the test database and apply all migrations from scratch.
 *
 * @returns {Promise<void>}
 */
export async function prepareTestDatabase() {
  const url = new URL(TEST_DATABASE_URL);
  url.searchParams.delete('schema');
  const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  } finally {
    await pool.end();
  }

  const result = spawnSync(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    encoding: 'utf-8'
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed for the test database:\n${result.stdout}\n${result.stderr}`);
  }
}

/**
 * Empty every table (but keep the schema) so each test file starts from the same state.
 *
 * @param {import('pg').Pool} pool Pool connected to the test database.
 * @returns {Promise<void>}
 */
export async function truncateAllTables(pool) {
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
  );
  if (rows.length === 0) return;
  const tables = rows.map(({ tablename }) => `"${tablename}"`).join(', ');
  await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}
