import { ValidationError } from '../errors/app-errors.js';

const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROOM_TYPES = Object.freeze(['CLASSROOM', 'LAB', 'SEMINAR_HALL']);
const SUBJECT_TYPES = Object.freeze(['LECTURE', 'LAB', 'TUTORIAL']);

/**
 * Read a required text field.
 *
 * @param {object} body Request body.
 * @param {string} field Field name.
 * @param {string[]} problems Collected problems.
 * @param {number} [max] Maximum length.
 * @returns {string}
 */
function text(body, field, problems, max = 128) {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`${field} is required`);
    return '';
  }
  if (value.trim().length > max) problems.push(`${field} must be at most ${max} characters`);
  return value.trim();
}

/**
 * Read an optional whole number within a range.
 *
 * @param {object} body Request body.
 * @param {string} field Field name.
 * @param {string[]} problems Collected problems.
 * @param {{ min: number, max: number, fallback: number }} range Allowed range and default.
 * @returns {number}
 */
function integer(body, field, problems, { min, max, fallback }) {
  if (body[field] === undefined || body[field] === '') return fallback;
  const value = Number(body[field]);
  if (!Number.isInteger(value) || value < min || value > max) {
    problems.push(`${field} must be a whole number between ${min} and ${max}`);
    return fallback;
  }
  return value;
}

/**
 * Read an optional identifier.
 *
 * @param {object} body Request body.
 * @param {string[]} problems Collected problems.
 * @param {string} fallback Value used when the client sends none.
 * @returns {string}
 */
function identifier(body, problems, fallback) {
  if (body.id === undefined || body.id === '') return fallback;
  if (typeof body.id !== 'string' || !ID_PATTERN.test(body.id)) {
    problems.push('id may only contain letters, digits, dots, dashes and underscores (max 64)');
    return fallback;
  }
  return body.id;
}

/**
 * Turn text into an identifier fragment.
 *
 * @param {string} value Text.
 * @returns {string}
 */
function toIdFragment(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

/**
 * Fail with every collected problem.
 *
 * @param {string[]} problems Problems found.
 */
function assertNoProblems(problems) {
  if (problems.length > 0) throw new ValidationError(problems);
}

/** @param {object} body Raw subject. @returns {object} Clean subject. */
export function validateSubject(body = {}) {
  const problems = [];
  const code = text(body, 'code', problems, 32);
  const name = text(body, 'name', problems, 255);
  const type = String(body.type ?? 'LECTURE').toUpperCase();
  if (!SUBJECT_TYPES.includes(type)) problems.push(`type must be one of ${SUBJECT_TYPES.join(', ')}`);
  const requiredHoursPerWeek = integer(body, 'requiredHoursPerWeek', problems, { min: 1, max: 20, fallback: 3 });
  const credits = integer(body, 'credits', problems, { min: 0, max: 20, fallback: 3 });
  const id = identifier(body, problems, `SUB_${toIdFragment(code)}`);
  assertNoProblems(problems);
  return { id, code, name, type, requiredHoursPerWeek, credits };
}

/** @param {object} body Raw faculty member. @returns {object} Clean faculty member. */
export function validateFaculty(body = {}) {
  const problems = [];
  const name = text(body, 'name', problems);
  const email = text(body, 'email', problems, 255).toLowerCase();
  if (email && !EMAIL_PATTERN.test(email)) problems.push('email is not valid');
  const department = typeof body.department === 'string' && body.department.trim() ? body.department.trim().slice(0, 128) : 'Computer Science';
  const maxHoursPerWeek = integer(body, 'maxHoursPerWeek', problems, { min: 1, max: 40, fallback: 18 });
  const id = identifier(body, problems, `F_${toIdFragment(name)}`);
  assertNoProblems(problems);
  return { id, name, email, department, maxHoursPerWeek };
}

/** @param {object} body Raw room. @returns {object} Clean room. */
export function validateRoom(body = {}) {
  const problems = [];
  const name = text(body, 'name', problems);
  const capacity = integer(body, 'capacity', problems, { min: 1, max: 1000, fallback: 0 });
  if (capacity === 0 && !problems.includes('capacity must be a whole number between 1 and 1000')) problems.push('capacity is required');
  const type = String(body.type ?? 'CLASSROOM').toUpperCase();
  if (!ROOM_TYPES.includes(type)) problems.push(`type must be one of ${ROOM_TYPES.join(', ')}`);
  const building = typeof body.building === 'string' && body.building.trim() ? body.building.trim().slice(0, 128) : 'Academic Block';
  const id = identifier(body, problems, `R_${toIdFragment(name)}`);
  assertNoProblems(problems);
  return { id, name, building, capacity, type, isShared: body.isShared === true };
}

/** @param {object} body Raw section. @returns {object} Clean section. */
export function validateSection(body = {}) {
  const problems = [];
  const name = text(body, 'name', problems);
  const studentCount = integer(body, 'studentCount', problems, { min: 1, max: 500, fallback: 0 });
  if (studentCount === 0 && !problems.some((p) => p.startsWith('studentCount'))) problems.push('studentCount is required');
  const program = typeof body.program === 'string' && body.program.trim() ? body.program.trim().slice(0, 128) : 'B.Tech CSE';
  const semester = integer(body, 'semester', problems, { min: 1, max: 10, fallback: 5 });
  const batch = body.batch === undefined || body.batch === '' ? null : integer(body, 'batch', problems, { min: 2000, max: 2100, fallback: 0 });
  const id = identifier(body, problems, `SEC_${toIdFragment(name)}`);
  assertNoProblems(problems);
  return { id, name, program, semester, studentCount, batch };
}

/**
 * Validate an identifier taken from a URL.
 *
 * @param {string} id Raw identifier.
 * @returns {string}
 */
export function validateIdParam(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new ValidationError('id has an invalid format');
  return id;
}
