import { CALENDAR_AUTH_STATUS } from '../constants/statuses.js';

/**
 * Data access for Google Calendar connections (one per user). Tokens are encrypted on the way in
 * and decrypted on the way out; callers never see the stored (encrypted) columns.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db Prisma client or transaction.
 * @param {{ encrypt: Function, decrypt: Function }} tokenCipher Token cipher.
 */
export function createCalendarConnectionRepository(db, tokenCipher) {
  /** Convert a row into a connection with plain tokens. */
  const toConnection = (row) => {
    if (!row) return null;
    const { accessTokenEnc, refreshTokenEnc, ...rest } = row;
    return { ...rest, accessToken: tokenCipher.decrypt(accessTokenEnc), refreshToken: tokenCipher.decrypt(refreshTokenEnc) };
  };

  return {
    /**
     * Find a user's calendar connection.
     *
     * @param {string} userId User id.
     * @returns {Promise<object | null>}
     */
    async findByUserId(userId) {
      return toConnection(await db.googleCalendarConnection.findUnique({ where: { userId } }));
    },

    /**
     * Create or replace a user's calendar connection after Google authorisation.
     * An existing refresh token is kept when Google does not send a new one.
     *
     * @param {{ userId: string, googleAccountEmail?: string, tokenExpiresAt: Date, canRefreshToken?: boolean, accessToken?: string, refreshToken?: string | null }} connection Connection details.
     * @returns {Promise<void>}
     */
    async save(connection) {
      const tokens = {};
      if (connection.accessToken) tokens.accessTokenEnc = tokenCipher.encrypt(connection.accessToken);
      if (connection.refreshToken) tokens.refreshTokenEnc = tokenCipher.encrypt(connection.refreshToken);

      const fields = {
        googleAccountEmail: connection.googleAccountEmail || null,
        authStatus: CALENDAR_AUTH_STATUS.ACTIVE,
        tokenExpiresAt: connection.tokenExpiresAt,
        ...tokens
      };
      if (connection.canRefreshToken !== undefined || connection.refreshToken) {
        fields.canRefreshToken = connection.canRefreshToken ?? Boolean(connection.refreshToken);
      }
      await db.googleCalendarConnection.upsert({
        where: { userId: connection.userId },
        create: { userId: connection.userId, canRefreshToken: false, ...fields },
        update: fields
      });
    },

    /**
     * Store a refreshed access token.
     *
     * @param {string} userId User id.
     * @param {{ accessToken: string, tokenExpiresAt: Date }} tokens New access token.
     * @returns {Promise<void>}
     */
    async updateAccessToken(userId, { accessToken, tokenExpiresAt }) {
      await db.googleCalendarConnection.update({
        where: { userId },
        data: { accessTokenEnc: tokenCipher.encrypt(accessToken), tokenExpiresAt, authStatus: CALENDAR_AUTH_STATUS.ACTIVE }
      });
    },

    /**
     * Flag the connection as needing the user to authorise Google again.
     *
     * @param {string} userId User id.
     * @returns {Promise<void>}
     */
    async markReauthRequired(userId) {
      await db.googleCalendarConnection.update({
        where: { userId },
        data: { authStatus: CALENDAR_AUTH_STATUS.REAUTH_REQUIRED }
      });
    },

    /**
     * Store the outcome of a successful sync.
     *
     * @param {string} userId User id.
     * @param {number} eventsCount Number of events pushed.
     * @param {Date} syncedAt Time of the sync.
     * @param {string[]} [syncedEventIds] Google event ids that now exist for this user.
     * @returns {Promise<void>}
     */
    async recordSync(userId, eventsCount, syncedAt, syncedEventIds = []) {
      await db.googleCalendarConnection.update({ where: { userId }, data: { eventsCount, lastSyncedAt: syncedAt, syncedEventIds } });
    },

    /**
     * Remove the connection and its stored tokens.
     *
     * @param {string} userId User id.
     * @returns {Promise<void>}
     */
    async remove(userId) {
      await db.googleCalendarConnection.deleteMany({ where: { userId } });
    }
  };
}
