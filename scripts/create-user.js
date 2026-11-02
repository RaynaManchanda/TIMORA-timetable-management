/**
 * Create a user account from the command line. This is how the first coordinator is created in
 * production, where demo accounts are (rightly) disabled and self-registration only makes
 * students and faculty.
 *
 *   npm run user:create -- --email registrar@college.edu --name "Registrar" --role COORDINATOR
 *   npm run user:create -- --email x@college.edu --name "X" --role FACULTY --faculty F_DR_X
 *   docker compose exec api node scripts/create-user.js --email ... --name ... --role COORDINATOR
 *
 * Without --password a strong random password is generated and printed once.
 * Give the person the password and ask them to change it after signing in.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { config } from '../src/config/config.js';
import { createDatabase } from '../src/db/database.js';
import { createUserRepository } from '../src/repositories/user-repository.js';
import { createPasswordService } from '../src/auth/password-service.js';
import { ROLES } from '../src/constants/roles.js';
import { findPasswordProblems } from '../src/validation/auth-validator.js';
import { generateId } from '../src/utils/id-generator.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: ROLES.COORDINATOR },
    password: { type: 'string' },
    section: { type: 'string' },
    faculty: { type: 'string' }
  }
});

/**
 * A random password that satisfies the password policy.
 *
 * @returns {string}
 */
function generatePassword() {
  return `Tm${randomBytes(9).toString('base64url')}7a`;
}

const role = String(values.role).toUpperCase();
if (!values.email || !values.name || !Object.values(ROLES).includes(role)) {
  console.error('Usage: create-user --email <email> --name <name> [--role ADMIN|COORDINATOR|FACULTY|STUDENT] [--password <password>] [--section <id>] [--faculty <id>]');
  process.exit(1);
}

const password = values.password ?? generatePassword();
const problems = findPasswordProblems(password);
if (problems.length > 0) {
  console.error(`The password is not acceptable: ${problems.join('; ')}`);
  process.exit(1);
}

const database = createDatabase({ connectionString: config.databaseUrl, ssl: config.databaseSsl });
try {
  const users = createUserRepository(database.prisma);
  const passwordHash = await createPasswordService({ cost: config.bcryptCost }).hash(password);
  const user = await users.create({
    id: generateId('USR'),
    name: values.name,
    email: values.email,
    passwordHash,
    role,
    sectionId: values.section,
    facultyId: values.faculty
  });

  console.log(`Created ${user.role} account ${user.email}`);
  if (values.password === undefined) console.log(`Password (shown once): ${password}`);
} catch (error) {
  console.error(`Could not create the account: ${error.message}`);
  process.exitCode = 1;
} finally {
  await database.close();
}
