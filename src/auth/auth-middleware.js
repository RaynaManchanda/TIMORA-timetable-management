import { AuthenticationError, ForbiddenError } from '../errors/app-errors.js';
import { ADMIN_ROLES } from '../constants/roles.js';

/**
 * Read the bearer token from an Authorization header.
 *
 * @param {string | undefined} headerValue Raw header value.
 * @returns {string | null} The token, or null when the header is missing or empty.
 */
function extractToken(headerValue) {
  if (!headerValue) return null;
  const token = headerValue.startsWith('Bearer ') ? headerValue.slice(7) : headerValue;
  return token.trim() || null;
}

/**
 * Create the authentication and authorisation middleware.
 *
 * @param {{ verify: (token: string) => object }} tokenService Token verifier.
 * @param {{ findAuthSubject: (id: string) => Promise<object | null> }} userRepository Used to re-check the account on every request.
 * @param {{ cacheMs?: number }} [options] cacheMs: how long (milliseconds) a looked-up account may be reused. 0 re-checks on every request.
 * @returns {{ authenticate: Function, requireRole: (roles: string[]) => Function, requireAdmin: Function }}
 */
export function createAuthMiddleware(tokenService, userRepository, { cacheMs = 0 } = {}) {
  // Tiny per-process cache so a burst of requests from one user costs one lookup, not one per request.
  const recent = new Map();

  /**
   * Load the account, reusing a lookup made within the last `cacheMs` milliseconds.
   *
   * @param {string} id User id.
   * @returns {Promise<object | null>}
   */
  async function loadSubject(id) {
    if (cacheMs <= 0) return userRepository.findAuthSubject(id);

    const now = Date.now();
    const hit = recent.get(id);
    if (hit && hit.expiresAt > now) return hit.subject;

    const subject = await userRepository.findAuthSubject(id);
    if (recent.size > 5000) recent.clear();
    recent.set(id, { subject, expiresAt: now + cacheMs });
    return subject;
  }

  /**
   * Reject requests without a valid token and attach the CURRENT user to the request.
   *
   * The signed token only proves who the caller was when it was issued. The account is
   * therefore loaded again, so a disabled account, a changed role or a revoked token
   * (password change, sign out everywhere) takes effect on the very next request.
   */
  async function authenticate(req, res, next) {
    try {
      const token = extractToken(req.headers.authorization);
      if (!token) {
        throw new AuthenticationError('Authentication token is required.');
      }

      const payload = tokenService.verify(token);
      const user = await loadSubject(payload.id);

      if (!user || !user.isActive) {
        throw new AuthenticationError('Invalid authentication token.');
      }
      if ((payload.tv ?? 0) !== user.tokenVersion) {
        throw new AuthenticationError('Your session is no longer valid. Please sign in again.');
      }

      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sectionId: user.sectionId,
        facultyId: user.facultyId
      };
      return next();
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Build a middleware that only lets the listed roles through.
   *
   * @param {string[]} allowedRoles Roles that may access the route.
   * @returns {Function}
   */
  function requireRole(allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return next(new AuthenticationError('Authentication token is required.'));
      }
      if (!allowedRoles.includes(req.user.role)) {
        return next(new ForbiddenError());
      }
      return next();
    };
  }

  return { authenticate, requireRole, requireAdmin: requireRole(ADMIN_ROLES) };
}
