import { createSecretKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../errors/app-errors.js';

const ALGORITHM = 'HS256';

/**
 * Create a service that issues and verifies signed access tokens.
 *
 * Besides the signature and expiry, each token carries the version number of the user's tokens
 * ("tv"). Changing the password or signing out everywhere bumps that number in the database,
 * which makes every older token invalid immediately.
 *
 * @param {{ secret: string, expiresInMinutes: number, issuer?: string }} options JWT settings.
 */
export function createTokenService({ secret, expiresInMinutes, issuer = 'timora' }) {
  // A ready-made key object spares jsonwebtoken from re-parsing the secret string on every request.
  const key = createSecretKey(Buffer.from(secret));

  return {
    /**
     * Issue an access token for a user.
     *
     * @param {{ id: string, email: string, name: string, role: string, sectionId?: string, facultyId?: string, tokenVersion?: number }} user Authenticated user.
     * @returns {string} Signed token.
     */
    issue(user) {
      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sectionId: user.sectionId || null,
        facultyId: user.facultyId || null,
        tv: user.tokenVersion ?? 0
      };

      return jwt.sign(payload, key, { algorithm: ALGORITHM, expiresIn: `${expiresInMinutes}m`, issuer, subject: user.id });
    },

    /**
     * Verify a token and return its payload.
     * Throws an AuthenticationError for expired or tampered tokens.
     *
     * @param {string} token Raw token.
     * @returns {object} Decoded payload.
     */
    verify(token) {
      try {
        const payload = jwt.verify(token, key, { algorithms: [ALGORITHM] });
        if (payload.iss !== undefined && payload.iss !== issuer) {
          throw new AuthenticationError('Invalid authentication token.');
        }
        return payload;
      } catch (error) {
        if (error instanceof AuthenticationError) throw error;
        if (error.name === 'TokenExpiredError') {
          throw new AuthenticationError('Authentication token has expired.');
        }
        throw new AuthenticationError('Invalid authentication token.');
      }
    },

    /**
     * Short-lived signed value for the Google consent round trip. It names the user who started
     * it, and is only accepted for that purpose (never as a login token).
     *
     * @param {string} userId User who starts the connection.
     * @returns {string}
     */
    issueState(userId) {
      return jwt.sign({ purpose: 'gcal-connect', sub: userId }, key, { algorithm: ALGORITHM, expiresIn: '10m', issuer });
    },

    /**
     * @param {string} state Value returned by Google.
     * @returns {string} The user id that started the connection.
     */
    verifyState(state) {
      try {
        const payload = jwt.verify(state, key, { algorithms: [ALGORITHM], issuer });
        if (payload.purpose !== 'gcal-connect') throw new Error('wrong purpose');
        return payload.sub;
      } catch {
        throw new AuthenticationError('The Google sign-in expired or is invalid. Please start the connection again.');
      }
    },

    /** Lifetime of issued tokens, in minutes. */
    expiresInMinutes
  };
}
