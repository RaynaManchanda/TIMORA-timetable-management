import { ValidationError } from '../errors/app-errors.js';
import { ROLES } from '../constants/roles.js';
import { SECTION_ID_PATTERN } from '../constants/academic.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
/** bcrypt ignores everything after 72 bytes, so longer passwords would be silently truncated. */
const MAX_PASSWORD_LENGTH = 72;
const MAX_NAME_LENGTH = 128;
const MAX_EMAIL_LENGTH = 255;

/**
 * Check a password against the password policy.
 *
 * @param {unknown} password Candidate password.
 * @param {string} [label] Field name used in messages.
 * @returns {string[]} Policy violations, empty when the password is acceptable.
 */
export function findPasswordProblems(password, label = 'password') {
  if (typeof password !== 'string' || password.length === 0) {
    return [`${label} is required`];
  }

  const problems = [];
  if (password.length < MIN_PASSWORD_LENGTH) problems.push(`${label} must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (password.length > MAX_PASSWORD_LENGTH) problems.push(`${label} must be at most ${MAX_PASSWORD_LENGTH} characters`);
  if (!/[a-z]/.test(password)) problems.push(`${label} must contain a lowercase letter`);
  if (!/[A-Z]/.test(password)) problems.push(`${label} must contain an uppercase letter`);
  if (!/\d/.test(password)) problems.push(`${label} must contain a digit`);
  return problems;
}

/**
 * Validate and clean a registration request body.
 * Throws a ValidationError listing every problem found.
 *
 * @param {object} body Raw request body.
 * @returns {{ name: string, email: string, password: string, role: string, department?: string, sectionId?: string }}
 */
export function validateRegistration(body = {}) {
  const { name, email, password, department, sectionId } = body;
  const role = String(body.role || ROLES.STUDENT).toUpperCase();
  const errors = [];

  if (typeof name !== 'string' || name.trim() === '') errors.push('name is required');
  else if (name.trim().length > MAX_NAME_LENGTH) errors.push(`name must be at most ${MAX_NAME_LENGTH} characters`);
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim()) || email.trim().length > MAX_EMAIL_LENGTH) {
    errors.push('a valid email is required');
  }
  errors.push(...findPasswordProblems(password));
  if (!Object.values(ROLES).includes(role)) errors.push(`role must be one of ${Object.values(ROLES).join(', ')}`);
  if (sectionId !== undefined && !SECTION_ID_PATTERN.test(String(sectionId))) errors.push('sectionId has an invalid format');
  if (department !== undefined && (typeof department !== 'string' || department.length > MAX_NAME_LENGTH)) {
    errors.push('department is invalid');
  }

  if (errors.length > 0) throw new ValidationError(errors);

  return { name: name.trim(), email: email.trim(), password, role, department, sectionId };
}

/**
 * Validate a login request body.
 * Only presence is checked so malformed emails fail the same way as unknown ones.
 *
 * @param {object} body Raw request body.
 * @returns {{ email: string, password: string }}
 */
export function validateLogin(body = {}) {
  const errors = [];
  if (typeof body.email !== 'string' || body.email.trim() === '') errors.push('email is required');
  if (typeof body.password !== 'string' || body.password === '') errors.push('password is required');
  if (typeof body.email === 'string' && body.email.length > MAX_EMAIL_LENGTH) errors.push('email is too long');
  if (typeof body.password === 'string' && body.password.length > 1024) errors.push('password is too long');

  if (errors.length > 0) throw new ValidationError(errors);

  return { email: body.email, password: body.password };
}

/**
 * Validate a change-password request body.
 *
 * @param {object} body Raw request body.
 * @returns {{ currentPassword: string, newPassword: string }}
 */
export function validateChangePassword(body = {}) {
  const errors = [];
  if (typeof body.currentPassword !== 'string' || body.currentPassword === '') errors.push('currentPassword is required');
  errors.push(...findPasswordProblems(body.newPassword, 'newPassword'));
  if (typeof body.newPassword === 'string' && body.newPassword === body.currentPassword) {
    errors.push('newPassword must be different from the current password');
  }

  if (errors.length > 0) throw new ValidationError(errors);

  return { currentPassword: body.currentPassword, newPassword: body.newPassword };
}
