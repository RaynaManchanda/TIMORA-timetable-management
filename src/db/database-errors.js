import { ConflictError, ValidationError } from '../errors/app-errors.js';

const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';
const RECORD_NOT_FOUND = 'P2025';

/**
 * Friendly names for the columns that can fail a foreign key check.
 */
const REFERENCE_LABELS = Object.freeze({
  section_id: 'section',
  subject_id: 'subject',
  faculty_id: 'faculty member',
  room_id: 'room',
  slot_id: 'time slot'
});

/**
 * Names of the unique constraints / indexes, whichever way the driver reports them.
 *
 * @param {{ meta?: { target?: string | string[], constraint?: string }, message?: string }} error Prisma error.
 * @returns {string}
 */
function describeTarget(error) {
  const { target, constraint } = error.meta ?? {};
  return [constraint, ...(Array.isArray(target) ? target : [target])].filter(Boolean).join(' ') + ` ${error.message ?? ''}`;
}

/**
 * Build a conflict message for a violated timetable unique constraint.
 *
 * @param {string} target Constraint or column names reported by the database.
 * @param {{ roomId?: string, facultyId?: string, sectionId?: string, day?: string, slot?: string }} entry Entry that was being saved.
 * @returns {string | null} Message, or null when the constraint is not a timetable one.
 */
function describeTimetableConflict(target, entry) {
  const when = `${entry.day} slot ${entry.slot}`;

  if (target.includes('uq_room_day_slot_version') || /room_id/.test(target)) {
    return `Room ${entry.roomId} is already booked for ${when}.`;
  }
  if (target.includes('uq_faculty_day_slot_version') || /faculty_id/.test(target)) {
    return `Faculty ${entry.facultyId} is already booked for ${when}.`;
  }
  if (target.includes('uq_section_core_slot') || /section_id/.test(target)) {
    return `Section ${entry.sectionId} already has a class on ${when}.`;
  }
  return null;
}

/**
 * Convert a Prisma error raised while saving a timetable entry into an application error.
 * Unknown errors are returned untouched so they surface as server errors.
 *
 * @param {Error & { code?: string, meta?: object }} error Error thrown by Prisma.
 * @param {object} entry Entry that was being saved.
 * @returns {Error}
 */
export function translateTimetableEntryError(error, entry) {
  if (error.code === UNIQUE_VIOLATION) {
    const message = describeTimetableConflict(describeTarget(error), entry);
    return message ? new ConflictError(message) : error;
  }

  if (error.code === FOREIGN_KEY_VIOLATION) {
    const column = /(section_id|subject_id|faculty_id|room_id|slot_id)/.exec(describeTarget(error))?.[1];
    const label = REFERENCE_LABELS[column];
    return label ? new ValidationError(`Unknown ${label}: ${entry[toCamelCase(column)]}`) : error;
  }

  return error;
}

/**
 * Convert a snake_case column name to camelCase.
 *
 * @param {string} name Column name such as "faculty_id".
 * @returns {string} Property name such as "facultyId".
 */
function toCamelCase(name) {
  return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Check whether an error is a Prisma unique-constraint violation.
 *
 * @param {{ code?: string }} error Error thrown by Prisma.
 * @returns {boolean}
 */
export function isUniqueViolation(error) {
  return error?.code === UNIQUE_VIOLATION;
}

/**
 * Check whether an error means that other records still reference the targeted one.
 *
 * @param {{ code?: string }} error Error thrown by Prisma.
 * @returns {boolean}
 */
export function isForeignKeyViolation(error) {
  return error?.code === FOREIGN_KEY_VIOLATION;
}

/**
 * Check whether an error means that the targeted record does not exist.
 *
 * @param {{ code?: string }} error Error thrown by Prisma.
 * @returns {boolean}
 */
export function isRecordNotFound(error) {
  return error?.code === RECORD_NOT_FOUND;
}
