import { ValidationError } from '../errors/app-errors.js';
import { DAYS, SLOT_IDS, SECTION_ID_PATTERN } from '../constants/academic.js';

const REQUIRED_ENTRY_FIELDS = ['sectionId', 'subjectId', 'facultyId', 'roomId', 'day', 'slot'];
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const SESSION_TYPES = Object.freeze(['LECTURE', 'LAB', 'TUTORIAL', 'PROJECT']);

/**
 * Check whether a value is a non-empty string.
 *
 * @param {unknown} value Value to test.
 * @returns {boolean}
 */
function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Validate the body of a single timetable entry.
 * Collects every problem so the client can fix them in one go.
 *
 * @param {object} body Raw entry from the request.
 * @param {string} [label] Prefix for error messages, e.g. "entries[3]".
 * @returns {string[]} Validation messages, empty when the entry is valid.
 */
export function findEntryProblems(body = {}, label = '') {
  const prefix = label ? `${label}.` : '';
  const problems = [];

  for (const field of REQUIRED_ENTRY_FIELDS) {
    if (!isFilled(body[field])) problems.push(`${prefix}${field} is required`);
  }

  if (isFilled(body.sectionId) && !SECTION_ID_PATTERN.test(body.sectionId)) {
    problems.push(`${prefix}sectionId has an invalid format`);
  }
  for (const field of ['subjectId', 'facultyId', 'roomId']) {
    if (isFilled(body[field]) && !IDENTIFIER_PATTERN.test(body[field])) {
      problems.push(`${prefix}${field} has an invalid format`);
    }
  }
  if (isFilled(body.day) && !DAYS.includes(body.day.trim().toUpperCase())) {
    problems.push(`${prefix}day must be one of ${DAYS.join(', ')}`);
  }
  if (isFilled(body.slot) && !SLOT_IDS.includes(body.slot.trim().toUpperCase())) {
    problems.push(`${prefix}slot must be one of ${SLOT_IDS.join(', ')}`);
  }
  if (body.sessionType !== undefined && !SESSION_TYPES.includes(String(body.sessionType).trim().toUpperCase())) {
    problems.push(`${prefix}sessionType must be one of ${SESSION_TYPES.join(', ')}`);
  }
  if (body.isElective !== undefined && typeof body.isElective !== 'boolean') {
    problems.push(`${prefix}isElective must be true or false`);
  }
  if (body.coSectionIds !== undefined) {
    const valid =
      Array.isArray(body.coSectionIds) &&
      body.coSectionIds.length <= 20 &&
      body.coSectionIds.every((id) => typeof id === 'string' && SECTION_ID_PATTERN.test(id));
    if (!valid) problems.push(`${prefix}coSectionIds must be a list of section ids`);
  }

  return problems;
}

/**
 * Convert a validated request body into a clean entry object.
 *
 * @param {object} body Valid entry body.
 * @returns {{ sectionId: string, subjectId: string, facultyId: string, roomId: string, day: string, slot: string, sessionType: string, isElective: boolean, coSectionIds: string[] }}
 */
export function toCleanEntry(body) {
  return {
    sectionId: body.sectionId.trim(),
    subjectId: body.subjectId.trim(),
    facultyId: body.facultyId.trim(),
    roomId: body.roomId.trim(),
    day: body.day.trim().toUpperCase(),
    slot: body.slot.trim().toUpperCase(),
    sessionType: isFilled(body.sessionType) ? body.sessionType.trim().toUpperCase() : 'LECTURE',
    isElective: body.isElective === true,
    coSectionIds: [...new Set((body.coSectionIds ?? []).map((id) => id.trim()))].filter((id) => id !== body.sectionId.trim())
  };
}

/**
 * Validate and clean a request to create one timetable entry.
 *
 * @param {object} body Raw request body.
 * @returns {object} Clean entry.
 */
export function validateEntryPayload(body = {}) {
  const problems = findEntryProblems(body);
  if (problems.length > 0) throw new ValidationError(problems);
  return toCleanEntry(body);
}

/**
 * Validate the body of a request that saves a whole timetable version.
 *
 * @param {object} body Raw request body.
 * @returns {{ name: string, entries: object[], changeLog?: string, disruptionId?: string }}
 */
export function validateVersionPayload(body = {}) {
  const problems = [];

  if (!isFilled(body.name)) problems.push('name is required');
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    problems.push('entries must be a non-empty array');
  } else {
    body.entries.forEach((entry, index) => problems.push(...findEntryProblems(entry, `entries[${index}]`)));
  }

  if (problems.length > 0) throw new ValidationError(problems);

  return {
    name: body.name.trim(),
    entries: body.entries.map(toCleanEntry),
    changeLog: body.changeLog,
    disruptionId: body.disruptionId
  };
}

/**
 * Validate the query string of a timetable search.
 * Rejecting anything that is not a plain identifier keeps injection payloads out of the system.
 *
 * @param {{ section?: unknown, day?: unknown }} query Raw query parameters.
 * @returns {{ sectionId?: string, day?: string }}
 */
export function validateTimetableQuery(query = {}) {
  const problems = [];
  const filters = {};

  if (query.section !== undefined) {
    if (typeof query.section === 'string' && SECTION_ID_PATTERN.test(query.section)) {
      filters.sectionId = query.section;
    } else {
      problems.push('section has an invalid format');
    }
  }

  if (query.day !== undefined) {
    const day = typeof query.day === 'string' ? query.day.trim().toUpperCase() : '';
    if (DAYS.includes(day)) {
      filters.day = day;
    } else {
      problems.push(`day must be one of ${DAYS.join(', ')}`);
    }
  }

  if (problems.length > 0) throw new ValidationError(problems);
  return filters;
}
