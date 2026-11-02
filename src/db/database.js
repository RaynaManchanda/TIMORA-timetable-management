import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const { Pool } = pg;

/**
 * Open the database: one shared pg connection pool that Prisma uses for every query.
 *
 * Prisma talks to PostgreSQL through the pg driver adapter, so the pool below is the single
 * place that controls connection limits, timeouts and SSL for the whole application.
 *
 * @param {{ connectionString: string, ssl?: boolean, maxConnections?: number, log?: Array<string> }} options Connection settings.
 * @returns {{ prisma: import('@prisma/client').PrismaClient, pool: import('pg').Pool, close: () => Promise<void> }}
 */
export function createDatabase({ connectionString, ssl = false, maxConnections = 20, log = ['warn'] }) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to connect to PostgreSQL.');
  }

  const pool = new Pool({
    connectionString: stripPrismaParameters(connectionString),
    max: maxConnections,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: ssl ? { rejectUnauthorized: false } : false
  });

  // A broken idle connection must not crash the process; the pool replaces it.
  pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error:', error.message));

  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log });

  return {
    prisma,
    pool,
    async close() {
      await prisma.$disconnect();
      await pool.end().catch(() => {});
    }
  };
}

/**
 * Remove Prisma-only URL parameters (such as ?schema=public) that the pg driver does not understand.
 *
 * @param {string} connectionString PostgreSQL URL.
 * @returns {string}
 */
function stripPrismaParameters(connectionString) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('schema');
    return url.toString();
  } catch {
    return connectionString;
  }
}
