import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { STRONG_PASSWORD, createTestContext } from './helpers/test-context.js';

describe('Authentication: registration, login and password storage', () => {
  let context;

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterAll(() => context.close());

  /**
   * Register a user through the API.
   *
   * @param {object} overrides Fields replacing the valid defaults.
   * @returns {Promise<import('supertest').Response>}
   */
  const register = (overrides = {}) =>
    context.http().post('/api/auth/register').send({
      name: 'Asha Verma',
      email: 'asha.verma@timora.edu',
      password: STRONG_PASSWORD,
      role: 'STUDENT',
      ...overrides
    });

  test('TC01 - registers a user with valid details and never returns the password', async () => {
    const response = await register();

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({
      id: expect.any(String),
      name: 'Asha Verma',
      email: 'asha.verma@timora.edu',
      role: 'STUDENT'
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password|hash/i);
  });

  test('TC02 - rejects a duplicate email with 409 and creates no second account', async () => {
    const countUsers = async () => (await context.pool.query('SELECT COUNT(*)::int AS total FROM users')).rows[0].total;
    const before = await countUsers();

    const response = await register({ name: 'Someone Else' });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('An account with this email already exists.');
    expect(await countUsers()).toBe(before);
  });

  test('TC03 - logs in a faculty user and issues a token with id, role and 60 minute expiry', async () => {
    const { user, password } = await context.createUser({ role: 'FACULTY', facultyId: 'F101' });

    const response = await context.http().post('/api/auth/login').send({ email: user.email, password });

    expect(response.status).toBe(200);
    const payload = jwt.verify(response.body.token, context.config.jwt.secret);
    expect(payload).toMatchObject({ id: user.id, role: 'FACULTY' });
    expect(payload.exp - payload.iat).toBe(60 * 60);
  });

  test('TC04 - rejects a wrong password with a generic 401 message and issues no token', async () => {
    const { user } = await context.createUser();

    const wrongPassword = await context.http().post('/api/auth/login').send({ email: user.email, password: 'Wrong-Pass1' });
    const unknownEmail = await context.http().post('/api/auth/login').send({ email: 'nobody@timora.edu', password: 'Wrong-Pass1' });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.message).toBe('Invalid email or password.');
    expect(wrongPassword.body.token).toBeUndefined();
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  });

  test('TC05 - stores only a salted bcrypt hash with cost 12 that verifies the password', async () => {
    await register({ email: 'hash.check@timora.edu' });

    const { rows } = await context.pool.query('SELECT password_hash FROM users WHERE email = $1', ['hash.check@timora.edu']);
    const storedHash = rows[0].password_hash;

    expect(storedHash).toMatch(/^\$2[aby]\$12\$/);
    expect(storedHash).not.toContain(STRONG_PASSWORD);
    expect(await bcrypt.compare(STRONG_PASSWORD, storedHash)).toBe(true);
  });

  test('TC19 - blocks the 6th failed login within the window with HTTP 429', async () => {
    const { user } = await context.createUser();
    const attemptLogin = () => context.http().post('/api/auth/login').send({ email: user.email, password: 'Wrong-Pass1' });

    const statuses = [];
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      statuses.push((await attemptLogin()).status);
    }

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    const blocked = await attemptLogin();
    expect(blocked.body.message).toBe('Too many login attempts. Please try again in 15 minutes.');
  });

  test('keeps the account locked even when the correct password is used during the lockout', async () => {
    const { user, password } = await context.createUser();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await context.http().post('/api/auth/login').send({ email: user.email, password: 'Wrong-Pass1' });
    }

    const response = await context.http().post('/api/auth/login').send({ email: user.email, password });

    expect(response.status).toBe(429);
  });

  test('a successful login clears earlier failed attempts', async () => {
    const { user, password } = await context.createUser();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await context.http().post('/api/auth/login').send({ email: user.email, password: 'Wrong-Pass1' });
    }

    const success = await context.http().post('/api/auth/login').send({ email: user.email, password });
    const afterReset = await context.http().post('/api/auth/login').send({ email: user.email, password: 'Wrong-Pass1' });

    expect(success.status).toBe(200);
    expect(afterReset.status).toBe(401);
  });

  test('rejects weak passwords and lists every policy problem', async () => {
    const response = await register({ email: 'weak@timora.edu', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.validationErrors).toEqual(
      expect.arrayContaining([
        'password must be at least 8 characters',
        'password must contain an uppercase letter',
        'password must contain a digit'
      ])
    );
  });

  test('does not let visitors self-register an administrator account', async () => {
    const response = await register({ email: 'sneaky@timora.edu', role: 'ADMIN' });

    expect(response.status).toBe(403);
  });
});
