import { AuthenticationError, ConflictError, ForbiddenError, ValidationError } from '../errors/app-errors.js';
import { SELF_REGISTRATION_ROLES } from '../constants/roles.js';
import { validateChangePassword, validateLogin, validateRegistration } from '../validation/auth-validator.js';
import { generateId } from '../utils/id-generator.js';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';

/**
 * Remove sensitive fields from a user before returning it to a client.
 *
 * @param {object} user Stored user.
 * @returns {{ id: string, name: string, email: string, role: string, sectionId?: string, facultyId?: string }}
 */
function toPublicUser(user) {
  const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  if (user.sectionId) publicUser.sectionId = user.sectionId;
  if (user.facultyId) publicUser.facultyId = user.facultyId;
  return publicUser;
}

/**
 * Create the authentication service (registration, login, password change).
 *
 * @param {{ userRepository: object, passwordService: object, tokenService: object, loginRateLimiter: object, academicRepository: object }} dependencies Collaborators.
 */
export function createAuthService({ userRepository, passwordService, tokenService, loginRateLimiter, academicRepository }) {
  return {
    /**
     * Register a new account. Only student and faculty accounts can be self-registered.
     *
     * @param {object} body Registration request body.
     * @returns {Promise<object>} The new user without any password data.
     */
    async register(body) {
      const input = validateRegistration(body);

      if (!SELF_REGISTRATION_ROLES.includes(input.role)) {
        throw new ForbiddenError('Administrator accounts can only be created by an administrator.');
      }

      if (input.sectionId) {
        const sections = await academicRepository.listSections();
        if (!sections.some((section) => section.id === input.sectionId)) {
          throw new ValidationError(`Unknown section: ${input.sectionId}`);
        }
      }

      const passwordHash = await passwordService.hash(input.password);
      const user = await userRepository.create({
        id: generateId('USR'),
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        department: input.department,
        sectionId: input.sectionId
      });

      return toPublicUser(user);
    },

    /**
     * Log a user in with email and password.
     * Wrong emails, wrong passwords and disabled accounts all return the same message so
     * accounts cannot be probed.
     *
     * @param {object} body Login request body.
     * @returns {Promise<{ token: string, user: object, expiresInMinutes: number }>}
     */
    async login(body) {
      const { email, password } = validateLogin(body);

      await loginRateLimiter.assertNotBlocked(email);

      const user = await userRepository.findByEmail(email);
      const passwordMatches = user
        ? await passwordService.verify(password, user.passwordHash)
        : await passwordService.verifyAgainstDummy(password);

      if (!passwordMatches || !user.isActive) {
        await loginRateLimiter.recordFailure(email);
        throw new AuthenticationError(INVALID_CREDENTIALS_MESSAGE);
      }

      await loginRateLimiter.reset(email);
      await userRepository.recordLogin(user.id, new Date());

      return {
        token: tokenService.issue(user),
        user: toPublicUser(user),
        expiresInMinutes: tokenService.expiresInMinutes
      };
    },

    /**
     * Change the password of the signed-in user. Every token issued before is revoked and a
     * fresh one is returned so the current session carries on.
     *
     * @param {string} userId Authenticated user id.
     * @param {object} body Request body with currentPassword and newPassword.
     * @returns {Promise<{ token: string, user: object, expiresInMinutes: number }>}
     */
    async changePassword(userId, body) {
      const { currentPassword, newPassword } = validateChangePassword(body);

      const user = await userRepository.findById(userId);
      if (!user) throw new AuthenticationError('Invalid authentication token.');
      await loginRateLimiter.assertNotBlocked(user.email);

      if (!(await passwordService.verify(currentPassword, user.passwordHash))) {
        await loginRateLimiter.recordFailure(user.email);
        throw new AuthenticationError('Current password is incorrect.');
      }

      const updated = await userRepository.changePassword(user.id, await passwordService.hash(newPassword));
      await loginRateLimiter.reset(user.email);

      return { token: tokenService.issue(updated), user: toPublicUser(updated), expiresInMinutes: tokenService.expiresInMinutes };
    },

    /**
     * Sign the user out of every device by revoking all tokens issued so far.
     *
     * @param {string} userId Authenticated user id.
     * @returns {Promise<void>}
     */
    async logoutEverywhere(userId) {
      await userRepository.revokeTokens(userId);
    },

    /**
     * Current profile of the signed-in user, read fresh from the database.
     *
     * @param {string} userId Authenticated user id.
     * @returns {Promise<object>}
     */
    async getProfile(userId) {
      const user = await userRepository.findById(userId);
      if (!user) throw new ConflictError('Account no longer exists.');
      return toPublicUser(user);
    }
  };
}
