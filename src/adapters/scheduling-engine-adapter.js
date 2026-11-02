/**
 * TIMORA - Scheduling Engine Adapter
 * Hard-constraint validation for a proposed class placement.
 *
 * The adapter is pure: reference data (rooms, subjects, reserved section blocks) is passed in a
 * `context` object, so the same checks run against live database data and against test fixtures.
 */

/**
 * All sections that attend an entry: its own section plus combined sections.
 *
 * @param {{ sectionId: string, coSectionIds?: string[] }} entry Timetable entry.
 * @returns {string[]}
 */
export function sectionsOf(entry) {
  return [entry.sectionId, ...(entry.coSectionIds ?? [])];
}

/**
 * Look up a record in either a Map or an array of records with an id.
 *
 * @param {Map<string, object> | object[] | undefined} source Records.
 * @param {string} id Record id.
 * @returns {object | undefined}
 */
function lookup(source, id) {
  if (!source) return undefined;
  return source instanceof Map ? source.get(id) : source.find((record) => record.id === id);
}

export class SchedulingEngineAdapter {
  /**
   * Check if a faculty member is free in a given day & slot. Project guidance is given by a panel,
   * so project sessions never block (and are never blocked by) other sessions.
   */
  checkFacultyAvailability(facultyId, day, slotId, currentEntries, ignoreEntryId = null, sessionType = 'LECTURE') {
    if (sessionType === 'PROJECT') return { isValid: true, conflict: null };

    const conflict = currentEntries.find(
      (entry) =>
        entry.id !== ignoreEntryId &&
        entry.sessionType !== 'PROJECT' &&
        entry.facultyId === facultyId &&
        entry.dayOfWeek === day &&
        entry.slotId === slotId
    );
    return {
      isValid: !conflict,
      conflict: conflict ? `Faculty ${facultyId} already scheduled in slot ${slotId} on ${day} (Entry ${conflict.id})` : null
    };
  }

  /**
   * Check if a room is free in a given day & slot. Shared facilities (workshops) host several classes at once.
   */
  checkRoomAvailability(roomId, day, slotId, currentEntries, ignoreEntryId = null, context = {}) {
    if (lookup(context.rooms, roomId)?.isShared) return { isValid: true, conflict: null };

    const conflict = currentEntries.find(
      (entry) =>
        entry.id !== ignoreEntryId &&
        entry.roomId === roomId &&
        entry.dayOfWeek === day &&
        entry.slotId === slotId
    );
    return {
      isValid: !conflict,
      conflict: conflict ? `Room ${roomId} already occupied in slot ${slotId} on ${day} (Entry ${conflict.id})` : null
    };
  }

  /**
   * Check if the student section(s) of a class are free in a given day & slot.
   * Parallel electives may overlap each other (students pick one), but never a core class.
   */
  checkSectionAvailability(sectionId, day, slotId, currentEntries, ignoreEntryId = null, { coSectionIds = [], isElective = false } = {}) {
    const wanted = new Set([sectionId, ...coSectionIds]);
    const conflict = currentEntries.find(
      (entry) =>
        entry.id !== ignoreEntryId &&
        entry.dayOfWeek === day &&
        entry.slotId === slotId &&
        !(isElective && entry.isElective) &&
        sectionsOf(entry).some((id) => wanted.has(id))
    );
    return {
      isValid: !conflict,
      conflict: conflict ? `Section ${sectionId} already has a class in slot ${slotId} on ${day} (Entry ${conflict.id})` : null
    };
  }

  /**
   * Check that the slot is not reserved for the section (lunch, mentoring, minor programme ...).
   *
   * @param {string[]} sectionIds Sections attending the class.
   * @param {string} day Day in display form ("Monday").
   * @param {string} slotId Slot id.
   * @param {{ blockKeys?: Set<string> }} context Context with the reserved keys "sectionId|Monday|S4".
   */
  checkSectionBlocks(sectionIds, day, slotId, context = {}) {
    if (!context.blockKeys) return { isValid: true };
    const blocked = sectionIds.find((id) => context.blockKeys.has(`${id}|${day}|${slotId}`));
    return blocked
      ? { isValid: false, conflict: `Section ${blocked} has reserved time (lunch, mentoring or minor programme) in slot ${slotId} on ${day}.` }
      : { isValid: true };
  }

  /**
   * Check room suitability (lab sessions require LAB rooms).
   */
  checkRoomSuitability(roomId, subjectId, context = {}, sessionType = null) {
    const room = lookup(context.rooms, roomId);
    const subject = lookup(context.subjects, subjectId);

    if (!room || !subject) {
      return { isValid: true, warning: 'Room or subject metadata missing.' };
    }

    const needsLab = subject.type === 'LAB' || sessionType === 'LAB';
    if (needsLab && room.type !== 'LAB') {
      return {
        isValid: false,
        conflict: `Subject ${subject.name} requires a LAB room. ${room.name} is a ${room.type}.`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate all hard constraints for a proposed slot assignment.
   */
  validateHardConstraints({ entry, targetDay, targetSlotId, targetRoomId, targetFacultyId, currentEntries, context = {} }) {
    const day = targetDay || entry.dayOfWeek;
    const slotId = targetSlotId || entry.slotId;
    const roomId = targetRoomId || entry.roomId;
    const facultyId = targetFacultyId || entry.facultyId;
    const ignoreEntryId = entry.id;

    const facultyCheck = this.checkFacultyAvailability(facultyId, day, slotId, currentEntries, ignoreEntryId, entry.sessionType);
    if (!facultyCheck.isValid) return facultyCheck;

    const roomCheck = this.checkRoomAvailability(roomId, day, slotId, currentEntries, ignoreEntryId, context);
    if (!roomCheck.isValid) return roomCheck;

    const sectionCheck = this.checkSectionAvailability(entry.sectionId, day, slotId, currentEntries, ignoreEntryId, entry);
    if (!sectionCheck.isValid) return sectionCheck;

    const blockCheck = this.checkSectionBlocks(sectionsOf(entry), day, slotId, context);
    if (!blockCheck.isValid) return blockCheck;

    const suitabilityCheck = this.checkRoomSuitability(roomId, entry.subjectId, context, entry.sessionType);
    if (!suitabilityCheck.isValid) return suitabilityCheck;

    return { isValid: true };
  }
}

export const schedulingEngineAdapter = new SchedulingEngineAdapter();
