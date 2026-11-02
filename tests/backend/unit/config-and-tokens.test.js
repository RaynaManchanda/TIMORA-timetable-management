import { describe, expect, test } from '@jest/globals';
import { loadConfig } from '../../../src/config/config.js';
import { createTokenService } from '../../../src/auth/token-service.js';
import { createLoginRateLimiter } from '../../../src/auth/login-rate-limiter.js';

describe('loadConfig', () => {
  test('uses safe defaults in development', () => {
    expect(loadConfig({})).toMatchObject({
      port: 3000,
      bcryptCost: 12,
      jwt: { expiresInMinutes: 60 },
      loginRateLimit: { maxFailedAttempts: 5, windowMinutes: 15 }
    });
  });

  test('refuses to start in production without a JWT secret', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow('JWT_SECRET');
  });

  test('ignores non-numeric numeric settings', () => {
    expect(loadConfig({ PORT: 'abc' }).port).toBe(3000);
  });
});

describe('token service', () => {
  const tokens = createTokenService({ secret: 'unit-secret', expiresInMinutes: 60 });
  const user = { id: 'U1', email: 'u@timora.edu', name: 'U', role: 'FACULTY', facultyId: 'F101' };

  test('round-trips the user id and role', () => {
    expect(tokens.verify(tokens.issue(user))).toMatchObject({ id: 'U1', role: 'FACULTY', facultyId: 'F101' });
  });

  test('rejects garbage tokens', () => {
    expect(() => tokens.verify('not.a.token')).toThrow('Invalid authentication token.');
  });
});

describe('login rate limiter', () => {
  /**
   * In-memory stand-in for the attempt repository.
   *
   * @returns {object}
   */
  function createFakeRepository() {
    const attempts = [];
    return {
      recordFailure: async (email, at) => attempts.push({ email, at }),
      countFailuresSince: async (email, since) => attempts.filter((a) => a.email === email && a.at > since).length,
      clear: async (email) => {
        for (let index = attempts.length - 1; index >= 0; index -= 1) {
          if (attempts[index].email === email) attempts.splice(index, 1);
        }
      }
    };
  }

  test('lets the account in again once the window has passed', async () => {
    let now = new Date('2026-11-01T10:00:00Z');
    const limiter = createLoginRateLimiter({
      loginAttemptRepository: createFakeRepository(),
      maxFailedAttempts: 2,
      windowMinutes: 15,
      clock: () => now
    });

    await limiter.recordFailure('A@Timora.edu');
    await limiter.recordFailure('a@timora.edu');
    await expect(limiter.assertNotBlocked('a@timora.edu')).rejects.toMatchObject({ statusCode: 429 });

    now = new Date('2026-11-01T10:16:00Z');
    await expect(limiter.assertNotBlocked('a@timora.edu')).resolves.toBeUndefined();
  });
});
