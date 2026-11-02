import { createHash } from 'node:crypto';
import { ServiceUnavailableError } from '../errors/app-errors.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'openid', 'email'];

/**
 * Is this 403 a "too many requests" answer (as opposed to a real permission problem)?
 * Reads a copy of the body so the original response can still be inspected later.
 *
 * @param {Response} response Failed response.
 * @returns {Promise<boolean>}
 */
async function isRateLimit(response) {
  const body = await response.clone().json().catch(() => ({}));
  const reason = body?.error?.errors?.[0]?.reason || '';
  return ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded', 'RATE_LIMIT_EXCEEDED'].includes(reason) ||
    /rate limit|quota/i.test(body?.error?.message || '');
}

/**
 * Turn a failed Calendar API response into an error that says what to do about it.
 *
 * @param {Response} response Failed response.
 * @returns {Promise<Error>}
 */
async function describeCalendarFailure(response) {
  const body = await response.json().catch(() => ({}));
  const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || '';
  const detail = body?.error?.message || '';

  if (reason === 'insufficientPermissions' || reason === 'PERMISSION_DENIED' && /scope/i.test(detail)) {
    return new GoogleAuthError('The calendar permission was not granted. Reconnect and tick the calendar checkbox.');
  }
  if (reason === 'accessNotConfigured' || /has not been used in project|is disabled/i.test(detail)) {
    return new ServiceUnavailableError(
      'The Google Calendar API is not enabled for this project. In Google Cloud Console open APIs & Services > Library, enable "Google Calendar API", wait a minute and try again.'
    );
  }
  if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded' || response.status === 429) {
    return new ServiceUnavailableError('Google is limiting requests right now. Progress is saved: wait a minute and sync again to continue.');
  }
  return new ServiceUnavailableError(`Google Calendar refused an event (HTTP ${response.status}${reason ? `, ${reason}` : ''}${detail ? `: ${detail}` : ''}).`);
}

/** Thrown when Google rejects a token (expired or revoked); the service then asks the user to reconnect. */
export class GoogleAuthError extends Error {}

/**
 * Create the client that talks to Google (OAuth 2.0 + Calendar API v3) using plain HTTPS.
 *
 * @param {{ clientId?: string, clientSecret?: string, redirectUri?: string, fetchImpl?: typeof fetch }} [settings] OAuth client settings.
 * @returns {object} Client used by the calendar service.
 */
export function createGoogleCalendarClient({ clientId, clientSecret, redirectUri, fetchImpl = fetch, maxSyncMs = 40_000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const isConfigured = Boolean(clientId && clientSecret && redirectUri);

  const assertConfigured = () => {
    if (!isConfigured) {
      throw new ServiceUnavailableError(
        'Google Calendar is not configured on the server. An administrator must set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI.'
      );
    }
  };

  /** POST a form to Google's token endpoint. */
  async function tokenRequest(params) {
    const response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (body.error === 'invalid_grant' || response.status === 400 || response.status === 401) {
        throw new GoogleAuthError(body.error_description || body.error || 'Google rejected the authorisation.');
      }
      throw new ServiceUnavailableError('Google is not reachable right now. Please try again.');
    }
    return body;
  }

  /**
   * Call the Calendar API, waiting and retrying when Google says "slow down" (rate limit, 429, 5xx).
   * Waits grow 1s, 2s, 4s ... (or what Retry-After asks for), up to 6 attempts.
   */
  async function callWithRetry(url, options, deadline = Infinity) {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(url, options);
      const limited = response.status === 429 || response.status >= 500 || (response.status === 403 && (await isRateLimit(response)));
      if (!limited || attempt >= 5) return response;

      const retryAfter = Number(response.headers?.get?.('retry-after'));
      const wait = (retryAfter > 0 ? retryAfter : 2 ** attempt) * 1000 + Math.random() * 250;
      // Never keep the user waiting past the time budget; the caller reports the limit instead.
      if (Date.now() + wait > deadline) return response;
      await sleep(wait);
    }
  }

  /** Google event ids may only use a-v and 0-9; derive a stable one from our entry id. */
  const googleEventId = (event, userId) => `t${createHash('sha1').update(`${userId}:${event.id}`).digest('hex')}`;

  return {
    isConfigured,

    /**
     * Address of Google's consent screen.
     *
     * @param {string} state Signed state value that is returned unchanged to the callback.
     * @returns {string}
     */
    buildAuthUrl(state) {
      assertConfigured();
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline', // gives a refresh token
        prompt: 'consent', // always return the refresh token
        include_granted_scopes: 'true',
        state
      });
      return `${AUTH_URL}?${params}`;
    },

    /**
     * Trade the one-time code from the callback for tokens.
     *
     * @param {string} code Authorisation code.
     * @returns {Promise<{ accessToken: string, refreshToken: string | null, tokenExpiresAt: Date, googleAccountEmail: string | null }>}
     */
    async exchangeCode(code) {
      assertConfigured();
      const body = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
      let email = null;
      try {
        email = JSON.parse(Buffer.from(String(body.id_token).split('.')[1], 'base64url').toString()).email ?? null;
      } catch {
        // The e-mail is only for display.
      }
      return {
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? null,
        tokenExpiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000),
        googleAccountEmail: email
      };
    },

    /**
     * Get a new access token from the stored refresh token. Throws when Google rejects it.
     *
     * @param {{ refreshToken: string | null }} connection The user's connection (tokens decrypted).
     * @returns {Promise<{ accessToken: string, tokenExpiresAt: Date }>}
     */
    async refreshAccessToken(connection) {
      assertConfigured();
      if (!connection.refreshToken) throw new GoogleAuthError('No refresh token is stored.');
      const body = await tokenRequest({ refresh_token: connection.refreshToken, grant_type: 'refresh_token' });
      return { accessToken: body.access_token, tokenExpiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000) };
    },

    /**
     * Create or update the recurring events in the user's primary calendar.
     * Running it again updates the same events instead of duplicating them.
     *
     * @param {{ userId: string, accessToken: string }} connection The user's connection (tokens decrypted).
     * @param {object[]} events Google Calendar event resources.
     * @returns {Promise<void>}
     */
    async pushEvents(connection, events) {
      assertConfigured();
      const headers = { Authorization: `Bearer ${connection.accessToken}`, 'Content-Type': 'application/json' };

      const deadline = Date.now() + maxSyncMs;
      const pushOne = async (event) => {
        const id = googleEventId(event, connection.userId);
        const { id: _ours, sourceTimetableEntryId, ...resource } = event;
        const body = JSON.stringify({ ...resource, id });

        let response = await callWithRetry(EVENTS_URL, { method: 'POST', headers, body }, deadline);
        if (response.status === 409) {
          response = await callWithRetry(`${EVENTS_URL}/${id}`, { method: 'PUT', headers, body }, deadline);
        }
        if (response.status === 401) throw new GoogleAuthError('Google rejected the access token.');
        if (!response.ok) throw await describeCalendarFailure(response);
      };

      // Two requests at a time: Google limits bursts per user, and retries above absorb the rest.
      const queue = [...events];
      const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
        while (queue.length > 0) await pushOne(queue.shift());
      });
      await Promise.all(workers);
      return events.map((event) => googleEventId(event, connection.userId));
    },

    /**
     * Remove events that TIMORA created earlier but that no longer apply (changed section or elective).
     * Events already deleted by hand (404 / 410) are ignored.
     *
     * @param {{ accessToken: string }} connection The connection (tokens decrypted).
     * @param {string[]} googleEventIds Ids returned by earlier pushEvents calls.
     * @returns {Promise<void>}
     */
    async deleteEvents(connection, googleEventIds) {
      assertConfigured();
      const headers = { Authorization: `Bearer ${connection.accessToken}` };
      const deadline = Date.now() + maxSyncMs;
      for (const id of googleEventIds) {
        const response = await callWithRetry(`${EVENTS_URL}/${id}`, { method: 'DELETE', headers }, deadline);
        if (response.status === 401) throw new GoogleAuthError('Google rejected the access token.');
        if (!response.ok && response.status !== 404 && response.status !== 410) throw await describeCalendarFailure(response);
      }
    },

    /**
     * Tell Google to forget the authorisation (best effort).
     *
     * @param {{ refreshToken?: string | null, accessToken?: string | null }} connection The user's connection (tokens decrypted).
     * @returns {Promise<void>}
     */
    async revoke(connection) {
      const token = connection.refreshToken || connection.accessToken;
      if (!isConfigured || !token) return;
      await fetchImpl(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token })
      }).catch(() => {});
    }
  };
}
