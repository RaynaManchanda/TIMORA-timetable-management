import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { bearer, createTestContext } from './helpers/test-context.js';

describe('Access control: tokens, roles and injection safety', () => {
  let context;
  let student;
  let admin;

  beforeAll(async () => {
    context = await createTestContext();
    student = await context.createUser({ role: 'STUDENT', sectionId: 'SEC_CSE_5A' });
    admin = await context.createUser({ role: 'COORDINATOR' });
  });

  afterAll(() => context.close());

  /**
   * Replace the payload of a signed token while keeping its original signature.
   *
   * @param {string} token Original token.
   * @param {object} changes Fields to overwrite in the payload.
   * @returns {string} Tampered token that no longer matches its signature.
   */
  function tamperWithPayload(token, changes) {
    const [header, payload, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const forgedPayload = Buffer.from(JSON.stringify({ ...decoded, ...changes })).toString('base64url');
    return [header, forgedPayload, signature].join('.');
  }

  test('TC06 - blocks a protected route without an access token', async () => {
    const response = await context.http().get('/api/timetables');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication token is required.');
  });

  test('TC07 - rejects a token whose payload was tampered with', async () => {
    const forgedToken = tamperWithPayload(student.token, { role: 'COORDINATOR' });

    const response = await context.http().get('/api/timetables').set(bearer(forgedToken));

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid authentication token.');
  });

  test('TC07 - rejects an expired token', async () => {
    const expiredToken = jwt.sign({ id: student.user.id, role: 'STUDENT' }, context.config.jwt.secret, { expiresIn: -10 });

    const response = await context.http().get('/api/timetables').set(bearer(expiredToken));

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication token has expired.');
  });

  test('TC07 - rejects a token signed with a different secret', async () => {
    const foreignToken = jwt.sign({ id: 'x', role: 'ADMIN' }, 'another-secret', { expiresIn: '1h' });

    const response = await context.http().get('/api/timetables').set(bearer(foreignToken));

    expect(response.status).toBe(401);
  });

  test('TC08 - denies a student access to the administrator generation route', async () => {
    const response = await context
      .http()
      .post('/api/admin/timetables/generate')
      .set(bearer(student.token))
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('You do not have permission to perform this action.');
    expect(response.body.entries).toBeUndefined();
  });

  test('TC08 - lets an administrator past the role check', async () => {
    const response = await context
      .http()
      .post('/api/admin/timetables/generate')
      .set(bearer(admin.token))
      .send({ sectionId: 'SEC_CSE_5A' });

    expect(response.status).not.toBe(403);
    expect(response.status).not.toBe(401);
  });

  test('TC18 - rejects SQL injection in the section query parameter with 400', async () => {
    const response = await context
      .http()
      .get('/api/timetables')
      .query({ section: "CSE5' OR '1'='1" })
      .set(bearer(admin.token));

    expect(response.status).toBe(400);
    expect(response.body.validationErrors).toContain('section has an invalid format');
    expect(response.body.entries).toBeUndefined();
  });

  test('TC18 - rejects SQL injection in the day query parameter with 400', async () => {
    const response = await context
      .http()
      .get('/api/timetables')
      .query({ day: "TUESDAY'; DROP TABLE users;--" })
      .set(bearer(admin.token));

    expect(response.status).toBe(400);
  });

  test('TC18 - treats an injection payload in the login email as plain data (401)', async () => {
    const usersBefore = (await context.pool.query('SELECT COUNT(*)::int AS total FROM users')).rows[0].total;

    const response = await context
      .http()
      .post('/api/auth/login')
      .send({ email: "admin@timora.edu' OR '1'='1", password: "' OR '1'='1" });

    const usersAfter = (await context.pool.query('SELECT COUNT(*)::int AS total FROM users')).rows[0].total;
    expect(response.status).toBe(401);
    expect(usersAfter).toBe(usersBefore);
  });

  test('returns 400 for malformed JSON instead of crashing', async () => {
    const response = await context
      .http()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ "email": ');

    expect(response.status).toBe(400);
  });

  test('returns 404 JSON for unknown API routes', async () => {
    const response = await context.http().get('/api/does-not-exist');

    expect(response.status).toBe(404);
  });
});
