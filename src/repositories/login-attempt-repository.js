/**
 * Data access for failed login attempts, used by the login rate limiter.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db Prisma client or transaction.
 */
export function createLoginAttemptRepository(db) {
  return {
    /**
     * Record one failed login attempt.
     *
     * @param {string} email Normalised email address.
     * @param {Date} attemptedAt Time of the attempt.
     * @returns {Promise<void>}
     */
    async recordFailure(email, attemptedAt) {
      await db.loginAttempt.create({ data: { email, attemptedAt } });
    },

    /**
     * Count failed attempts for an email since a point in time.
     *
     * @param {string} email Normalised email address.
     * @param {Date} since Start of the window.
     * @returns {Promise<number>}
     */
    countFailuresSince(email, since) {
      return db.loginAttempt.count({ where: { email, attemptedAt: { gt: since } } });
    },

    /**
     * Forget all failed attempts for an email, e.g. after a successful login.
     *
     * @param {string} email Normalised email address.
     * @returns {Promise<void>}
     */
    async clear(email) {
      await db.loginAttempt.deleteMany({ where: { email } });
    },

    /**
     * Delete attempts older than the lockout window so the table does not grow forever.
     *
     * @param {Date} before Attempts older than this are removed.
     * @returns {Promise<number>} Number of deleted rows.
     */
    async purgeOlderThan(before) {
      const { count } = await db.loginAttempt.deleteMany({ where: { attemptedAt: { lt: before } } });
      return count;
    }
  };
}
