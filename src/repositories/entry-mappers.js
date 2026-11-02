/**
 * Conversions between the database shape of a timetable entry and the two shapes the application uses:
 *
 *  - API shape     { day: 'TUESDAY', slot: 'S2', ... }            used by /api/timetables and the calendar
 *  - engine shape  { dayOfWeek: 'Tuesday', slotId: 'S2', ... }    used by the scheduling and rescheduling modules
 */

const DAY_NAMES = Object.freeze({
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday'
});

/**
 * "MONDAY" -> "Monday".
 *
 * @param {string} day Upper-case day.
 * @returns {string}
 */
export function toDisplayDay(day) {
  return DAY_NAMES[day] ?? day;
}

/**
 * "Monday" / "monday" / "MONDAY" -> "MONDAY".
 *
 * @param {string} day Day in any case.
 * @returns {string}
 */
export function toStoredDay(day) {
  return String(day).trim().toUpperCase();
}

/**
 * Public API shape of an entry row.
 *
 * @param {object} row Prisma timetable entry.
 * @returns {object}
 */
export function toApiEntry(row) {
  return {
    id: row.id,
    versionId: row.versionId,
    sectionId: row.sectionId,
    coSectionIds: row.coSectionIds ?? [],
    subjectId: row.subjectId,
    facultyId: row.facultyId,
    roomId: row.roomId,
    day: row.day,
    slot: row.slotId,
    sessionType: row.sessionType,
    isElective: row.isElective
  };
}

/**
 * Shape used by the scheduling and rescheduling engines.
 *
 * @param {object} row Prisma timetable entry.
 * @returns {object}
 */
export function toEngineEntry(row) {
  return {
    id: row.id,
    sectionId: row.sectionId,
    coSectionIds: row.coSectionIds ?? [],
    subjectId: row.subjectId,
    facultyId: row.facultyId,
    roomId: row.roomId,
    dayOfWeek: toDisplayDay(row.day),
    slotId: row.slotId,
    sessionType: row.sessionType,
    isElective: row.isElective
  };
}

/**
 * Prisma create-data for an engine-shaped entry.
 *
 * @param {object} entry Engine entry.
 * @param {string} versionId Version the entry belongs to.
 * @param {() => string} newId Id generator.
 * @returns {object}
 */
export function fromEngineEntry(entry, versionId, newId) {
  return {
    id: newId(),
    versionId,
    sectionId: entry.sectionId,
    coSectionIds: entry.coSectionIds ?? [],
    subjectId: entry.subjectId,
    facultyId: entry.facultyId,
    roomId: entry.roomId,
    day: toStoredDay(entry.dayOfWeek),
    slotId: entry.slotId,
    sessionType: entry.sessionType ?? 'LECTURE',
    isElective: Boolean(entry.isElective)
  };
}
