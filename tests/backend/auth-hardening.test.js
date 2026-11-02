import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { bearer, createTestContext, STRONG_PASSWORD } from './helpers/test-context.js';

describe('Authentication hardening', () => {
  let context;

  beforeAll(async () => {
    context = await createTestContext({ env: { BCRYPT_COST: '4' } });
  });

  afterAll(() => context.close());

  const login = (email, password = STRONG_PASSWORD) => context.http().post('/api/auth/login').send({ email, password });

  test('changing the password revokes every older token and returns a working fresh one', async () => {
    const { user, token: oldToken } = await context.createUser({ role: 'STUDENT', sectionId: 'SEC_CSE_5A' });
    const newPassword = 'An0therStrongPass';

    const change = await context
      .http()
      .post('/api/auth/change-password')
      .set(bearer(oldToken))
      .send({ currentPassword: STRONG_PASSWORD, newPassword });

    expect(change.status).toBe(200);
    expect(change.body.token).toEqual(expect.any(String));

    const withOld = await context.http().get('/api/auth/me').set(bearer(oldToken));
    expect(withOld.status).toBe(401);
    expect(withOld.body.message).toBe('Your session is no longer valid. Please sign in again.');

    expect((await context.http().get('/api/auth/me').set(bearer(change.body.token))).status).toBe(200);
    expect((await login(user.email)).status).toBe(401);
    expect((await login(user.email, newPassword)).status).toBe(200);
  });

  test('change-password checks the current password and the password policy', async () => {
    const { token } = await context.createUser({ role: 'STUDENT' });
    const send = (body) => context.http().post('/api/auth/change-password').set(bearer(token)).send(body);

    expect((await send({ currentPassword: 'wrong-Password1', newPassword: 'An0therStrongPass' })).status).toBe(401);

    const weak = await send({ currentPassword: STRONG_PASSWORD, newPassword: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.validationErrors).toEqual(expect.arrayContaining(['newPassword must be at least 8 characters']));

    const same = await send({ currentPassword: STRONG_PASSWORD, newPassword: STRONG_PASSWORD });
    expect(same.body.validationErrors).toEqual(['newPassword must be different from the current password']);

    expect((await context.http().post('/api/auth/change-password').send({})).status).toBe(401);
  });

  test('"sign out everywhere" invalidates the token', async () => {
    const { token } = await context.createUser({ role: 'FACULTY', facultyId: 'F101' });

    expect((await context.http().post('/api/auth/logout-all').set(bearer(token))).status).toBe(200);
    expect((await context.http().get('/api/timetables').set(bearer(token))).status).toBe(401);
  });

  test('a disabled account is rejected immediately, even with a valid token, and cannot log in', async () => {
    const { user, token } = await context.createUser({ role: 'STUDENT', sectionId: 'SEC_CSE_5A' });
    expect((await context.http().get('/api/timetables').set(bearer(token))).status).toBe(200);

    await context.prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    expect((await context.http().get('/api/timetables').set(bearer(token))).status).toBe(401);
    const attempt = await login(user.email);
    expect(attempt.status).toBe(401);
    expect(attempt.body.message).toBe('Invalid email or password.');
  });

  test('a changed role takes effect on the next request (the token is not trusted for the role)', async () => {
    const { user, token } = await context.createUser({ role: 'COORDINATOR' });
    expect((await context.http().get('/api/rescheduling/disruptions').set(bearer(token))).status).toBe(200);

    await context.prisma.user.update({ where: { id: user.id }, data: { role: 'STUDENT' } });

    expect((await context.http().get('/api/rescheduling/disruptions').set(bearer(token))).status).toBe(403);
  });

  test('the profile never contains the password hash', async () => {
    const { token } = await context.createUser({ role: 'STUDENT' });

    const response = await context.http().get('/api/auth/me').set(bearer(token));

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toMatch(/password|hash|\$2[aby]\$/i);
  });

  test('registration rejects an unknown section and an over-long password', async () => {
    const unknown = await context.http().post('/api/auth/register').send({
      name: 'New Student', email: 'new.student@timora.edu', password: STRONG_PASSWORD, role: 'STUDENT', sectionId: 'NOPE_SECTION'
    });
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toBe('Unknown section: NOPE_SECTION');

    const long = await context.http().post('/api/auth/register').send({
      name: 'New Student', email: 'long@timora.edu', password: `Aa1${'x'.repeat(80)}`, role: 'STUDENT'
    });
    expect(long.status).toBe(400);
    expect(long.body.validationErrors).toContain('password must be at most 72 characters');
  });

  test('the sign-up form can read the section list without a token, but nothing else', async () => {
    const sections = await context.http().get('/api/academic/sections');
    expect(sections.status).toBe(200);
    expect(sections.body.sections[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
    expect(sections.body.sections[0]).not.toHaveProperty('studentCount');

    for (const url of ['/api/academic/faculty', '/api/academic/rooms', '/api/academic/subjects', '/api/academic/time-slots']) {
      expect((await context.http().get(url)).status).toBe(401);
    }
  });

  test('responses carry security headers, are never cached and ignore foreign origins', async () => {
    const response = await context.http().get('/api/health').set('Origin', 'https://evil.example');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('a listed origin may call the API from a browser', async () => {
    const other = await createTestContext({ env: { CORS_ORIGINS: 'https://timetable.example.edu' } });
    try {
      const allowed = await other.http().get('/api/health').set('Origin', 'https://timetable.example.edu');
      const denied = await other.http().get('/api/health').set('Origin', 'https://evil.example');
      expect(allowed.headers['access-control-allow-origin']).toBe('https://timetable.example.edu');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await other.close();
    }
  });
});

describe('Per-address limit on the authentication endpoints', () => {
  test('answers 429 once one address has made too many requests', async () => {
    const context = await createTestContext({ env: { AUTH_RATE_MAX_REQUESTS: '3', BCRYPT_COST: '4' } });
    try {
      const attempt = () => context.http().post('/api/auth/login').send({ email: 'nobody@timora.edu', password: 'whatever' });

      const statuses = [];
      for (let i = 0; i < 5; i += 1) statuses.push((await attempt()).status);

      expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
      expect(statuses.slice(3)).toEqual([429, 429]);
    } finally {
      await context.close();
    }
  });
});

describe('Production configuration', () => {
  test('refuses a short JWT secret and does not create demo accounts unless asked', async () => {
    const { loadConfig } = await import('../../src/config/config.js');

    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'too-short' })).toThrow('at least 32 characters');
    expect(loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) }).seedDemoData).toBe(false);
    expect(loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), SEED_DEMO_DATA: 'true' }).seedDemoData).toBe(true);
    expect(loadConfig({}).seedDemoData).toBe(true);
  });
});
