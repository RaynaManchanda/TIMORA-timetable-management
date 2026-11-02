import bcrypt from 'bcryptjs';

/**
 * Create a service that hashes and verifies passwords with salted bcrypt.
 *
 * @param {{ cost: number }} options bcrypt cost factor (work factor).
 */
export function createPasswordService({ cost }) {
  let dummyHashPromise = null;

  /**
   * Hash used to keep login timing similar when the email is unknown.
   *
   * @returns {Promise<string>}
   */
  const getDummyHash = () => {
    dummyHashPromise ??= bcrypt.hash('timora-dummy-password', cost);
    return dummyHashPromise;
  };

  return {
    /**
     * Hash a password with a fresh random salt.
     *
     * @param {string} password Plain-text password.
     * @returns {Promise<string>} bcrypt hash.
     */
    hash(password) {
      return bcrypt.hash(password, cost);
    },

    /**
     * Check a password against a stored hash.
     *
     * @param {string} password Plain-text password.
     * @param {string} passwordHash Stored bcrypt hash.
     * @returns {Promise<boolean>}
     */
    verify(password, passwordHash) {
      return bcrypt.compare(password, passwordHash);
    },

    /**
     * Spend the same time as a real check, then report failure.
     * Prevents attackers from learning which emails exist by timing the response.
     *
     * @param {string} password Plain-text password.
     * @returns {Promise<false>}
     */
    async verifyAgainstDummy(password) {
      await bcrypt.compare(password, await getDummyHash());
      return false;
    }
  };
}
