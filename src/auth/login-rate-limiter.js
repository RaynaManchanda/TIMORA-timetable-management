import { TooManyRequestsError } from '../errors/app-errors.js';
import { normalizeEmail } from '../repositories/user-repository.js';

const MS_PER_MINUTE = 60 * 1000;

/**
 * Create a limiter that blocks an account after too many failed logins.
 * Failures are stored in the database so the limit survives restarts and multiple servers.
 *
 * @param {{ loginAttemptRepository: object, maxFailedAttempts: number, windowMinutes: number, clock?: () => Date }} options Limiter settings.
 */
export function createLoginRateLimiter({ loginAttemptRepository, maxFailedAttempts, windowMinutes, clock = () => new Date() }) {
  /**
   * Start of the window in which failures are counted.
   *
   * @returns {Date}
   */
  const windowStart = () => new Date(clock().getTime() - windowMinutes * MS_PER_MINUTE);

  return {
    /**
     * Throw a 429 error when the account has reached the failed-attempt limit.
     *
     * @param {string} email Email being used to log in.
     * @returns {Promise<void>}
     */
    async assertNotBlocked(email) {
      const failures = await loginAttemptRepository.countFailuresSince(normalizeEmail(email), windowStart());
      if (failures >= maxFailedAttempts) {
        throw new TooManyRequestsError(`Too many login attempts. Please try again in ${windowMinutes} minutes.`);
      }
    },

    /**
     * Remember a failed login.
     *
     * @param {string} email Email used in the failed attempt.
     * @returns {Promise<void>}
     */
    recordFailure(email) {
      return loginAttemptRepository.recordFailure(normalizeEmail(email), clock());
    },

    /**
     * Forget previous failures after a successful login.
     *
     * @param {string} email Email that logged in.
     * @returns {Promise<void>}
     */
    reset(email) {
      return loginAttemptRepository.clear(normalizeEmail(email));
    }
  };
}
