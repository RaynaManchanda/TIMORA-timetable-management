import { ConflictError } from '../errors/app-errors.js';
import { isUniqueViolation } from '../db/database-errors.js';

/**
 * Convert a users row into an application object.
 *
 * @param {object} row Prisma user.
 * @returns {object}
 */
function toUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    department: row.department,
    sectionId: row.sectionId,
    facultyId: row.facultyId,
    isActive: row.isActive,
    tokenVersion: row.tokenVersion,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt
  };
}

/**
 * Normalise an email so look-ups are case-insensitive.
 *
 * @param {string} email Raw email address.
 * @returns {string}
 */
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/**
 * Prisma data for a new user.
 *
 * @param {object} user User fields.
 * @returns {object}
 */
function toCreateData(user) {
  return {
    id: user.id,
    name: user.name.trim(),
    email: normalizeEmail(user.email),
    passwordHash: user.passwordHash,
    role: user.role,
    department: user.department || null,
    sectionId: user.sectionId || null,
    facultyId: user.facultyId || null
  };
}

/**
 * Data access for the users table.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db Prisma client or transaction.
 */
export function createUserRepository(db) {
  return {
    /**
     * Find a user by email address.
     *
     * @param {string} email Email address.
     * @returns {Promise<object | null>}
     */
    async findByEmail(email) {
      const row = await db.user.findUnique({ where: { email: normalizeEmail(email) } });
      return row ? toUser(row) : null;
    },

    /**
     * Load the fields the authentication middleware needs on every request (never the password hash).
     *
     * @param {string} id User id.
     * @returns {Promise<object | null>}
     */
    async findAuthSubject(id) {
      return db.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, role: true, sectionId: true, facultyId: true, isActive: true, tokenVersion: true }
      });
    },

    /**
     * Find a user by identifier.
     *
     * @param {string} id User id.
     * @returns {Promise<object | null>}
     */
    async findById(id) {
      const row = await db.user.findUnique({ where: { id } });
      return row ? toUser(row) : null;
    },

    /**
     * Create a user. Throws a conflict error when the email is already registered.
     *
     * @param {object} user User fields including a pre-computed passwordHash.
     * @returns {Promise<object>} The stored user.
     */
    async create(user) {
      try {
        return toUser(await db.user.create({ data: toCreateData(user) }));
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError('An account with this email already exists.');
        }
        throw error;
      }
    },

    /**
     * Create a user unless one with the same email already exists. Used for seeding.
     *
     * @param {object} user User fields including a pre-computed passwordHash.
     * @returns {Promise<boolean>} True when a new account was created.
     */
    async createIfMissing(user) {
      const { count } = await db.user.createMany({ data: [toCreateData(user)], skipDuplicates: true });
      return count > 0;
    },

    /**
     * List every active student that belongs to a section (as primary or combined section).
     *
     * @param {string} sectionId Section id.
     * @returns {Promise<object[]>}
     */
    async findStudentsBySection(sectionId) {
      const rows = await db.user.findMany({ where: { role: 'STUDENT', sectionId, isActive: true } });
      return rows.map(toUser);
    },

    /**
     * List the active user accounts linked to the given faculty ids.
     *
     * @param {string[]} facultyIds Faculty ids.
     * @returns {Promise<object[]>}
     */
    async findByFacultyIds(facultyIds) {
      if (facultyIds.length === 0) return [];
      const rows = await db.user.findMany({ where: { facultyId: { in: facultyIds }, isActive: true } });
      return rows.map(toUser);
    },

    /**
     * Store a new password hash and invalidate every token issued before now.
     *
     * @param {string} id User id.
     * @param {string} passwordHash New bcrypt hash.
     * @returns {Promise<object>} The updated user.
     */
    async changePassword(id, passwordHash) {
      const row = await db.user.update({ where: { id }, data: { passwordHash, tokenVersion: { increment: 1 } } });
      return toUser(row);
    },

    /**
     * Invalidate every token issued to a user ("sign out everywhere").
     *
     * @param {string} id User id.
     * @returns {Promise<void>}
     */
    async revokeTokens(id) {
      await db.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
    },

    /**
     * Remember when a user last signed in.
     *
     * @param {string} id User id.
     * @param {Date} at Time of the login.
     * @returns {Promise<void>}
     */
    async recordLogin(id, at) {
      await db.user.update({ where: { id }, data: { lastLoginAt: at } });
    }
  };
}
