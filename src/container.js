import { createPasswordService } from './auth/password-service.js';
import { createTokenService } from './auth/token-service.js';
import { createLoginRateLimiter } from './auth/login-rate-limiter.js';
import { createAuthService } from './auth/auth-service.js';
import { createAuthMiddleware } from './auth/auth-middleware.js';
import { createTimetableService } from './timetable/timetable-service.js';
import { createNotificationService } from './notifications/notification-service.js';
import { createCalendarService } from './calendar/calendar-service.js';
import { createGoogleCalendarClient } from './calendar/google-calendar-client.js';
import { createAdaptiveService } from './adaptive/adaptive-service.js';
import { createGenerationService } from './scheduling/generation-service.js';
import { createTokenCipher } from './auth/token-cipher.js';
import { createUserRepository } from './repositories/user-repository.js';
import { createLoginAttemptRepository } from './repositories/login-attempt-repository.js';
import { createAcademicRepository } from './repositories/academic-repository.js';

/**
 * Build every service the application needs from a Prisma client and configuration.
 * This is the single place where dependencies are wired together.
 *
 * @param {{ prisma: import('@prisma/client').PrismaClient, config: object, overrides?: { googleClient?: object, clock?: () => Date } }} options Prisma client, configuration and optional test doubles.
 * @returns {object} Services and middleware ready to be passed to createApp.
 */
export function createServices({ prisma, config, overrides = {} }) {
  const userRepository = createUserRepository(prisma);
  const academicRepository = createAcademicRepository(prisma);
  const passwordService = createPasswordService({ cost: config.bcryptCost });
  const tokenService = createTokenService(config.jwt);

  const loginRateLimiter = createLoginRateLimiter({
    loginAttemptRepository: createLoginAttemptRepository(prisma),
    maxFailedAttempts: config.loginRateLimit.maxFailedAttempts,
    windowMinutes: config.loginRateLimit.windowMinutes,
    clock: overrides.clock
  });

  const googleClient =
    overrides.googleClient ??
    createGoogleCalendarClient(config.google);

  const notificationService = createNotificationService({ prisma });

  return {
    prisma,
    userRepository,
    academicRepository,
    passwordService,
    tokenService,
    auth: createAuthMiddleware(tokenService, userRepository, { cacheMs: config.authCacheMs }),
    authService: createAuthService({ userRepository, passwordService, tokenService, loginRateLimiter, academicRepository }),
    timetableService: createTimetableService({ prisma }),
    notificationService,
    adaptiveService: createAdaptiveService({ prisma, notificationService }),
    generationService: createGenerationService({ prisma }),
    calendarService: createCalendarService({
      prisma,
      googleClient,
      tokenService,
      tokenCipher: createTokenCipher(config.tokenEncryptionKey),
      timeZone: config.calendar.timeZone,
      clock: overrides.clock
    })
  };
}
