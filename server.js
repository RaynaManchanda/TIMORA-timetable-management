/**
 * TIMORA - Server entry point.
 * Connects to PostgreSQL through Prisma, makes sure the reference data exists and starts the HTTP server.
 *
 * The database schema is managed by Prisma migrations ("npx prisma migrate deploy"), which the
 * Docker image runs before starting this file.
 */

import { config } from './src/config/config.js';
import { createDatabase } from './src/db/database.js';
import { seedTimeSlots, seedDemoUsers } from './src/db/seed.js';
import { createServices } from './src/container.js';
import { createApp } from './src/app.js';

/**
 * Start the API server and shut it down cleanly on SIGINT / SIGTERM.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const database = createDatabase({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl,
    maxConnections: config.databasePoolSize
  });
  const { prisma } = database;

  await prisma.$connect();
  await seedTimeSlots(prisma);

  const services = createServices({ prisma, config });
  if (config.seedDemoData) {
    const { created } = await seedDemoUsers(prisma, services.userRepository, services.passwordService);
    if (created > 0) console.log(`Created ${created} demo account(s). Never enable SEED_DEMO_DATA in production.`);
  }

  const activeVersion = await services.adaptiveService.getVersionOverview().catch(() => null);
  if (!activeVersion) {
    console.warn('No timetable has been imported yet. Run "npm run db:import" to load the college workbook.');
  }

  const server = createApp({ services, config }).listen(config.port, () => {
    console.log(`TIMORA API listening on http://localhost:${config.port}`);
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(async () => {
      await database.close();
      process.exit(0);
    });
    // Do not hang forever on keep-alive connections.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start TIMORA:', error);
  process.exit(1);
});
