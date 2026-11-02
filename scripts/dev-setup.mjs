/**
 * Development database setup. Runs automatically before "npm run dev" (npm "predev" hook):
 *
 *   1. makes sure Docker is running (starts Docker Desktop on Windows/macOS when it is not),
 *   2. creates .env from .env.example with generated secrets when there is none,
 *   3. starts the PostgreSQL container (docker compose up -d --wait db),
 *   4. loads database/timora-dev.dump.sql when the database is empty ("flash"),
 *   5. applies any Prisma migrations newer than the dump.
 *
 *   npm run db:flash      force step 4 even when the database already has data (replaces it!)
 *   npm run db:dump       rewrite database/timora-dev.dump.sql from the running dev database
 *
 * Existing data is never overwritten unless you ask for it with db:flash (or SETUP_FLASH=true).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DUMP_FILE = join(root, 'database', 'timora-dev.dump.sql');
const ENV_FILE = join(root, '.env');
const args = new Set(process.argv.slice(2));
const log = (message) => console.log(`[dev-setup] ${message}`);
const fail = (message) => {
  console.error(`[dev-setup] ${message}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run a command; returns { ok, stdout, stderr }. */
function run(command, commandArgs, { input, cwd = root } = {}) {
  const result = spawnSync(command, commandArgs, { cwd, input, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: false });
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
}

function readEnv() {
  const values = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

/** 2. A fresh clone has no .env: create one with generated secrets. */
function ensureEnvFile() {
  if (existsSync(ENV_FILE)) return;
  log('No .env found: creating it from .env.example with generated secrets.');
  copyFileSync(join(root, '.env.example'), ENV_FILE);
  const secret = (bytes) => randomBytes(bytes).toString('hex');
  const dbPassword = secret(12);
  let text = readFileSync(ENV_FILE, 'utf8');
  text = text
    .replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${dbPassword}`)
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=postgresql://timora_user:${dbPassword}@localhost:5434/timora_db?schema=public`)
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret(32)}`)
    .replace(/^TOKEN_ENCRYPTION_KEY=.*$/m, `TOKEN_ENCRYPTION_KEY=${secret(32)}`);
  writeFileSync(ENV_FILE, text);
}

/** 1. Docker must be running. */
async function ensureDocker() {
  if (run('docker', ['info']).ok) return;
  if (run('docker', ['--version']).error) fail('Docker is not installed. Install Docker Desktop: https://www.docker.com/products/docker-desktop');

  const desktop = {
    win32: 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
    darwin: '/Applications/Docker.app'
  }[process.platform];
  if (desktop && existsSync(desktop)) {
    log('Docker is not running: starting Docker Desktop (this can take a minute)...');
    if (process.platform === 'win32') run('powershell', ['-NoProfile', '-Command', `Start-Process '${desktop}'`]);
    else run('open', ['-a', 'Docker']);
    for (let waited = 0; waited < 180; waited += 3) {
      await sleep(3000);
      if (run('docker', ['info']).ok) return;
    }
  }
  fail('Docker is not running. Start Docker and run the command again.');
}

const psql = (env, sqlArgs, input) =>
  run('docker', ['exec', '-i', 'timora-postgres', 'psql', '-U', env.POSTGRES_USER || 'timora_user', '-d', env.POSTGRES_DB || 'timora_db', '-v', 'ON_ERROR_STOP=1', ...sqlArgs], { input });

/** 3. The database container. */
function startDatabase() {
  log('Starting the PostgreSQL container...');
  const up = run('docker', ['compose', 'up', '-d', '--wait', 'db']);
  if (!up.ok) fail(`Could not start the database container:\n${up.stderr || up.stdout}`);
}

/** 4. Replace the database content with the dump. */
function flash(env) {
  if (!existsSync(DUMP_FILE)) fail(`Dump file missing: ${DUMP_FILE}`);
  log('Flashing the database with database/timora-dev.dump.sql ...');
  const reset = psql(env, ['-c', 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;']);
  if (!reset.ok) fail(`Could not reset the schema:\n${reset.stderr}`);
  const load = psql(env, ['-q'], readFileSync(DUMP_FILE, 'utf8'));
  if (!load.ok) fail(`Loading the dump failed:\n${load.stderr}`);
  log('Dump loaded.');
}

function isInitialised(env) {
  const check = psql(env, ['-tA', '-c', 'SELECT count(*) FROM timetable_versions']);
  return check.ok && Number(check.stdout.trim()) > 0;
}

/** 5. Migrations newer than the dump. */
function migrate() {
  const prisma = join(root, 'node_modules', 'prisma', 'build', 'index.js');
  if (!existsSync(prisma)) fail('Dependencies are missing: run "npm install" first.');
  log('Applying pending Prisma migrations...');
  const result = run(process.execPath, [prisma, 'migrate', 'deploy']);
  if (!result.ok) fail(`prisma migrate deploy failed:\n${result.stderr || result.stdout}`);
  if (!existsSync(join(root, 'node_modules', '.prisma', 'client', 'index.js'))) {
    log('Generating the Prisma client...');
    const generated = run(process.execPath, [prisma, 'generate']);
    if (!generated.ok) fail(`prisma generate failed:\n${generated.stderr}`);
  }
}

/** Rewrite the dump from the running dev database, without secrets or personal/test data. */
function dump(env) {
  const user = env.POSTGRES_USER || 'timora_user';
  const db = env.POSTGRES_DB || 'timora_db';
  const sh = (script) => run('docker', ['exec', '-i', 'timora-postgres', 'sh', '-c', script]);
  const scratch = 'timora_dump_tmp';
  log('Writing a clean dump (no users, Google tokens, disruptions, drafts or extra versions)...');
  sh(`psql -U ${user} -d postgres -c "DROP DATABASE IF EXISTS ${scratch}" -c "CREATE DATABASE ${scratch}"`);
  const copied = sh(`pg_dump -U ${user} ${db} | psql -q -U ${user} -d ${scratch}`);
  if (!copied.ok) fail(`Could not copy the database:\n${copied.stderr}`);
  const clean = run('docker', ['exec', '-i', 'timora-postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', scratch], {
    input: `
BEGIN;
DELETE FROM approval_logs; DELETE FROM notifications; DELETE FROM disruptions;
DELETE FROM google_calendar_connections; DELETE FROM login_attempts; DELETE FROM user_electives; DELETE FROM users;
DELETE FROM timetable_entries WHERE version_id NOT IN (SELECT id FROM timetable_versions WHERE version_number = 'v1.0');
UPDATE timetable_versions SET status = 'ARCHIVED';
DELETE FROM timetable_versions WHERE version_number <> 'v1.0';
UPDATE timetable_versions SET status = 'ACTIVE', disruption_id = NULL WHERE version_number = 'v1.0';
COMMIT;`
  });
  if (!clean.ok) fail(`Cleaning the copy failed:\n${clean.stderr}`);
  const out = run('docker', ['exec', 'timora-postgres', 'pg_dump', '-U', user, '--no-owner', '--no-privileges', '--no-comments', scratch]);
  sh(`psql -U ${user} -d postgres -c "DROP DATABASE ${scratch}"`);
  if (!out.ok) fail(`pg_dump failed:\n${out.stderr}`);
  writeFileSync(DUMP_FILE, out.stdout);
  log(`Wrote ${DUMP_FILE}`);
}

ensureEnvFile();
await ensureDocker();
startDatabase();
const env = readEnv();

if (args.has('--dump')) {
  dump(env);
} else {
  const force = args.has('--flash') || process.env.SETUP_FLASH === 'true';
  if (force || !isInitialised(env)) flash(env);
  else log('Database already has data: keeping it (use "npm run db:flash" to replace it with the dump).');
  migrate();
  log('Ready.');
}
