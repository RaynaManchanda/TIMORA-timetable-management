/**
 * Application configuration.
 * All environment access is centralised here so the rest of the code base
 * receives plain, validated values instead of reading process.env directly.
 */

const DEVELOPMENT_JWT_SECRET = 'timora-development-only-secret-change-me';
const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * Parse an integer environment value, falling back to a default.
 *
 * @param {string | undefined} value Raw environment value.
 * @param {number} fallback Value used when the input is missing or invalid.
 * @returns {number}
 */
function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Split a comma separated environment value into trimmed, non-empty items.
 *
 * @param {string | undefined} value Raw environment value.
 * @returns {string[]}
 */
function toList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Build the application configuration from an environment object.
 * Throws in production when mandatory secrets are missing or weak.
 *
 * @param {Record<string, string | undefined>} [env] Environment variables.
 * @returns {Readonly<object>} Immutable configuration object.
 */
export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  if (isProduction && !env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set when NODE_ENV is "production".');
  }
  if (isProduction && env.JWT_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters long in production.`);
  }

  return Object.freeze({
    nodeEnv,
    isProduction,
    port: toInteger(env.PORT, 3000),
    databaseUrl: env.DATABASE_URL || '',
    databaseSsl: env.DATABASE_SSL === 'true',
    databasePoolSize: toInteger(env.DATABASE_POOL_SIZE, 20),
    // Demo accounts are on by default for development and must be asked for explicitly in production.
    seedDemoData: isProduction ? env.SEED_DEMO_DATA === 'true' : env.SEED_DEMO_DATA !== 'false',
    // Origins allowed to call the API from a browser. Empty = same origin only (the bundled frontend).
    corsOrigins: Object.freeze(toList(env.CORS_ORIGINS)),
    // Number of reverse proxies in front of the app (so rate limiting sees the real client address).
    trustProxy: toInteger(env.TRUST_PROXY, 0),
    jwt: Object.freeze({
      secret: env.JWT_SECRET || DEVELOPMENT_JWT_SECRET,
      expiresInMinutes: toInteger(env.JWT_EXPIRY_MINUTES, 60),
      issuer: env.JWT_ISSUER || 'timora'
    }),
    // Accounts are re-checked in the database on every request; a lookup may be reused for this many
    // milliseconds, so a disabled account or revoked token takes effect within that time (0 = instantly).
    authCacheMs: toInteger(env.AUTH_CACHE_MS, 0),
    bcryptCost: toInteger(env.BCRYPT_COST, 12),
    loginRateLimit: Object.freeze({
      maxFailedAttempts: toInteger(env.LOGIN_MAX_FAILED_ATTEMPTS, 5),
      windowMinutes: toInteger(env.LOGIN_LOCKOUT_MINUTES, 15)
    }),
    // Per-IP request limits for the public authentication endpoints (0 disables the limit).
    authRateLimit: Object.freeze({
      windowMinutes: toInteger(env.AUTH_RATE_WINDOW_MINUTES, 15),
      maxRequests: toInteger(env.AUTH_RATE_MAX_REQUESTS, 100)
    }),
    calendar: Object.freeze({
      timeZone: 'Asia/Kolkata'
    }),
    // Google Calendar (OAuth 2.0). Create an "OAuth client ID" of type "Web application" in
    // Google Cloud Console and add redirectUri to its authorised redirect URIs.
    google: Object.freeze({
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: env.GOOGLE_REDIRECT_URI || `http://localhost:${toInteger(env.PORT, 3000)}/`
    }),
    // Key that encrypts the stored Google tokens. Falls back to the JWT secret, but then changing
    // the JWT secret disconnects every calendar.
    tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY || env.JWT_SECRET || DEVELOPMENT_JWT_SECRET
  });
}

export const config = loadConfig();
