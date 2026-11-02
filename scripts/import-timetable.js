/**
 * Import the college timetable workbook into PostgreSQL.
 *
 *   npm run db:import                          (uses the newest workbook in data/)
 *   npm run db:import -- path/to/file.xlsx     (a newer revision: adds a new version)
 *   npm run db:import -- --force               (import a file that was imported before)
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config/config.js';
import { createDatabase } from '../src/db/database.js';
import { seedTimeSlots } from '../src/db/seed.js';
import { importCollegeTimetable } from '../src/importer/import-service.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

/**
 * Pick the workbook: the path given on the command line, or the newest .xlsx in data/.
 *
 * @param {string | undefined} argument Path from the command line.
 * @returns {Promise<string>}
 */
async function resolveWorkbook(argument) {
  if (argument) return path.resolve(argument);
  const files = (await readdir(dataDir)).filter((name) => name.toLowerCase().endsWith('.xlsx') && !name.startsWith('~$'));
  if (files.length === 0) throw new Error(`No .xlsx workbook found in ${dataDir}. Pass the file path as an argument.`);
  return path.join(dataDir, files.sort().at(-1));
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const database = createDatabase({ connectionString: config.databaseUrl, ssl: config.databaseSsl });

try {
  const filePath = await resolveWorkbook(args.find((arg) => !arg.startsWith('--')));
  console.log(`Importing ${filePath}`);

  await seedTimeSlots(database.prisma);
  const result = await importCollegeTimetable({ prisma: database.prisma, filePath, force, log: console.log });

  if (result.skipped) {
    console.log(`Skipped: ${result.reason} Use --force to import it again.`);
  } else {
    console.log(`Created timetable version ${result.versionNumber} (${result.versionId}).`);
    console.table(result.summary);
    const problems = result.issues.filter((issue) => issue.severity !== 'info');
    for (const issue of problems) console.log(`  [${issue.severity}] ${issue.sheet} ${issue.cell ?? ''}: ${issue.message}`);
    console.log(`${problems.length} cell(s) need the administrator's attention; all issues are stored in import_batches.`);
  }
} catch (error) {
  console.error('Import failed:', error);
  process.exitCode = 1;
} finally {
  await database.close();
}
