import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { createGoogleCalendarClient } from '../../src/calendar/google-calendar-client.js';
import { createTokenCipher } from '../../src/auth/token-cipher.js';
import { bearer, createTestContext } from './helpers/test-context.js';

/** A fake Google: records requests and answers like the real token / calendar endpoints. */
function createFakeGoogle() {
  const calls = [];
  const idToken = `x.${Buffer.from(JSON.stringify({ email: 'student.gmail@example.com' })).toString('base64url')}.y`;
  const fetchImpl = jest.fn(async (url, options = {}) => {
    const body = options.body instanceof URLSearchParams ? Object.fromEntries(options.body) : options.body;
    calls.push({ url: String(url), method: options.method, body, headers: options.headers });
    const json = (status, payload) => ({ ok: status < 400, status, json: async () => payload });

    if (String(url).endsWith('/token')) {
      if (body.code === 'bad-code') return json(400, { error: 'invalid_grant' });
      if (body.grant_type === 'refresh_token') return json(200, { access_token: 'access-2', expires_in: 3600 });
      return json(200, { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600, id_token: idToken });
    }
    if (String(url).includes('/events/') && options.method === 'PUT') return json(200, {});
    if (String(url).endsWith('/events')) return json(JSON.parse(options.body).summary.startsWith('DUP') ? 409 : 200, {});
    return json(200, {});
  });
  return { fetchImpl, calls };
}

describe('Connecting Google Calendar', () => {
  let context;
  let fake;
  let student;
  let other;

  beforeAll(async () => {
    fake = createFakeGoogle();
    const googleClient = createGoogleCalendarClient({
      clientId: 'client-id', clientSecret: 'client-secret', redirectUri: 'http://localhost:3000/', fetchImpl: fake.fetchImpl
    });
    context = await createTestContext({ overrides: { googleClient }, withEntries: true, env: { BCRYPT_COST: '4' } });
    student = await context.createUser({ role: 'STUDENT', sectionId: 'SEC_CSE_5A' });
    other = await context.createUser({ role: 'STUDENT', sectionId: 'SEC_CSE_5A' });
  });

  afterAll(() => context.close());

  const post = (url, user, body = {}) => context.http().post(url).set(bearer(user.token)).send(body);
  const stateOf = (url) => new URL(url).searchParams.get('state');

  test('status reports that the server is configured and the user is not connected yet', async () => {
    const status = await context.http().get('/api/calendar/status').set(bearer(student.token));

    expect(status.body).toMatchObject({ configured: true, connected: false, authStatus: 'DISCONNECTED' });
  });

  test('syncing before connecting explains that the account must be connected first', async () => {
    const response = await post('/api/calendar/sync', student);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Google Calendar is not connected. Please connect your account first.');
    expect(response.body.connectionStatus).toBe('DISCONNECTED');
  });

  test('connect returns the Google consent URL with offline access and a signed state', async () => {
    const { body } = await post('/api/calendar/connect', student);
    const url = new URL(body.url);

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('scope')).toContain('calendar.events');
    expect(url.searchParams.get('state')).toEqual(expect.any(String));
  });

  test('only the account that started the connection can finish it', async () => {
    const { body } = await post('/api/calendar/connect', student);

    const stolen = await post('/api/calendar/connect/complete', other, { code: 'good', state: stateOf(body.url) });
    expect(stolen.status).toBe(401);

    const forged = await post('/api/calendar/connect/complete', student, { code: 'good', state: 'not-a-state' });
    expect(forged.status).toBe(401);

    expect((await post('/api/calendar/connect/complete', student, {})).status).toBe(400);
    expect((await context.http().post('/api/calendar/connect/complete').send({})).status).toBe(401);
  });

  test('a rejected code is reported without connecting', async () => {
    const { body } = await post('/api/calendar/connect', student);

    const response = await post('/api/calendar/connect/complete', student, { code: 'bad-code', state: stateOf(body.url) });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/did not accept the authorisation/);
    expect((await context.http().get('/api/calendar/status').set(bearer(student.token))).body.connected).toBe(false);
  });

  test('completing stores the tokens ENCRYPTED, and sync pushes the events with the decrypted token', async () => {
    const { body } = await post('/api/calendar/connect', student);
    const done = await post('/api/calendar/connect/complete', student, { code: 'good', state: stateOf(body.url) });

    expect(done.status).toBe(200);
    expect(done.body.googleAccountEmail).toBe('student.gmail@example.com');

    const { rows } = await context.pool.query('SELECT * FROM google_calendar_connections WHERE user_id = $1', [student.user.id]);
    expect(rows[0].access_token_enc).toMatch(/^v1:/);
    expect(JSON.stringify(rows[0])).not.toContain('refresh-1');
    expect(JSON.stringify(rows[0])).not.toContain('access-1');
    expect(rows[0]).toMatchObject({ auth_status: 'ACTIVE', can_refresh_token: true });

    const status = await context.http().get('/api/calendar/status').set(bearer(student.token));
    expect(status.body).toMatchObject({ connected: true, googleAccountEmail: 'student.gmail@example.com' });

    fake.calls.length = 0;
    const sync = await post('/api/calendar/sync', student);
    expect(sync.status).toBe(200);
    const eventCalls = fake.calls.filter((c) => c.url.endsWith('/calendars/primary/events'));
    expect(eventCalls.length).toBe(sync.body.eventsCount);
    expect(eventCalls[0].headers.Authorization).toBe('Bearer access-1');
    expect(JSON.parse(eventCalls[0].body).id).toMatch(/^t[0-9a-f]{40}$/);
  });

  test('an expired access token is refreshed with the stored refresh token and saved', async () => {
    await context.pool.query("UPDATE google_calendar_connections SET token_expires_at = now() - interval '1 hour' WHERE user_id = $1", [student.user.id]);
    fake.calls.length = 0;

    const sync = await post('/api/calendar/sync', student);

    expect(sync.status).toBe(200);
    expect(fake.calls.some((c) => c.body?.grant_type === 'refresh_token' && c.body.refresh_token === 'refresh-1')).toBe(true);
    expect(fake.calls.find((c) => c.url.endsWith('/events')).headers.Authorization).toBe('Bearer access-2');
    const { rows } = await context.pool.query('SELECT token_expires_at FROM google_calendar_connections WHERE user_id = $1', [student.user.id]);
    expect(rows[0].token_expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  test('disconnecting revokes the access at Google and removes the stored tokens', async () => {
    fake.calls.length = 0;

    const response = await post('/api/calendar/disconnect', student);

    expect(response.status).toBe(200);
    expect(fake.calls.some((c) => c.url.endsWith('/revoke'))).toBe(true);
    const { rows } = await context.pool.query('SELECT 1 FROM google_calendar_connections WHERE user_id = $1', [student.user.id]);
    expect(rows).toHaveLength(0);
  });
});

describe('Without Google credentials', () => {
  test('the status says so and connecting names the settings an administrator must provide', async () => {
    const context = await createTestContext({ env: { BCRYPT_COST: '4' } });
    try {
      const { token } = await context.createUser({ role: 'STUDENT' });

      const status = await context.http().get('/api/calendar/status').set(bearer(token));
      expect(status.body.configured).toBe(false);

      const connect = await context.http().post('/api/calendar/connect').set(bearer(token)).send({});
      expect(connect.status).toBe(503);
      expect(connect.body.message).toMatch(/GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI/);
    } finally {
      await context.close();
    }
  });
});

describe('token cipher', () => {
  test('round-trips, uses a fresh IV, and refuses tampered data or another key', () => {
    const cipher = createTokenCipher('key-one');
    const a = cipher.encrypt('secret-token');
    const b = cipher.encrypt('secret-token');

    expect(a).not.toBe(b);
    expect(cipher.decrypt(a)).toBe('secret-token');
    expect(cipher.decrypt(a.slice(0, -2) + 'AA')).toBeNull();
    expect(createTokenCipher('key-two').decrypt(a)).toBeNull();
    expect(cipher.encrypt('')).toBeNull();
    expect(cipher.decrypt(null)).toBeNull();
  });
});

describe('Google rate limits', () => {
  /** Minimal Response stand-in. */
  const reply = (status, payload = {}, headers = {}) => ({
    ok: status < 400,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => payload,
    clone() { return reply(status, payload, headers); }
  });
  const rateLimit = () => reply(403, { error: { errors: [{ reason: 'rateLimitExceeded' }], message: 'Rate Limit Exceeded' } });
  const event = { id: 'E1', summary: 'X', start: {}, end: {} };

  test('waits and retries instead of failing, then succeeds', async () => {
    const answers = [rateLimit(), reply(429), reply(200)];
    const sleeps = [];
    const client = createGoogleCalendarClient({
      clientId: 'a', clientSecret: 'b', redirectUri: 'http://x/', fetchImpl: async () => answers.shift(), sleep: async (ms) => sleeps.push(ms)
    });

    await expect(client.pushEvents({ userId: 'U', accessToken: 't' }, [event])).resolves.toHaveLength(1);

    expect(sleeps).toHaveLength(2);
    expect(sleeps[1]).toBeGreaterThan(sleeps[0]);
  });

  test('gives up with a clear message when Google keeps refusing', async () => {
    const client = createGoogleCalendarClient({
      clientId: 'a', clientSecret: 'b', redirectUri: 'http://x/', fetchImpl: async () => rateLimit(), sleep: async () => {}
    });

    await expect(client.pushEvents({ userId: 'U', accessToken: 't' }, [event])).rejects.toThrow(/limiting requests/);
  });

  test('a genuine permission 403 is not retried', async () => {
    let calls = 0;
    const client = createGoogleCalendarClient({
      clientId: 'a', clientSecret: 'b', redirectUri: 'http://x/', sleep: async () => {},
      fetchImpl: async () => { calls += 1; return reply(403, { error: { errors: [{ reason: 'insufficientPermissions' }], message: 'Insufficient Permission' } }); }
    });

    await expect(client.pushEvents({ userId: 'U', accessToken: 't' }, [event])).rejects.toThrow(/permission was not granted/);
    expect(calls).toBe(1);
  });
});

describe('Syncing as a coordinator', () => {
  test('must choose one section instead of pushing the whole college timetable', async () => {
    const pushEvents = jest.fn();
    const googleClient = { isConfigured: true, refreshAccessToken: jest.fn(), pushEvents };
    const context = await createTestContext({ overrides: { googleClient }, withEntries: true, env: { BCRYPT_COST: '4' } });
    try {
      const admin = await context.createUser({ role: 'COORDINATOR' });
      await context.services.calendarService.saveConnection({
        userId: admin.user.id, tokenExpiresAt: new Date(Date.now() + 3600_000), accessToken: 'a', refreshToken: 'r'
      });
      const sync = (body) => context.http().post('/api/calendar/sync').set(bearer(admin.token)).send(body);

      const without = await sync({});
      expect(without.status).toBe(400);
      expect(without.body.message).toBe('Choose which section to use (sectionId).');
      expect(pushEvents).not.toHaveBeenCalled();

      const withSection = await sync({ sectionId: 'SEC_CSE_5B' });
      expect(withSection.status).toBe(200);
      expect(withSection.body.eventsCount).toBe(2);
    } finally {
      await context.close();
    }
  });
});
