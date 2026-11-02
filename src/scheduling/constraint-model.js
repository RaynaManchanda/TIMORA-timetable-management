/**
 * TIMORA - Constraint Model
 * Person 1: Rishank Mishra (Core Scheduling & Optimization)
 * Defines and validates academic scheduling constraints (hard and soft).
 */

export const CONSTRAINT_TYPES = {
  FACULTY_NO_DOUBLE_BOOKING: 'FACULTY_NO_DOUBLE_BOOKING',
  ROOM_NO_DOUBLE_BOOKING: 'ROOM_NO_DOUBLE_BOOKING',
  SECTION_NO_DOUBLE_BOOKING: 'SECTION_NO_DOUBLE_BOOKING',
  ROOM_CAPACITY_SUFFICIENT: 'ROOM_CAPACITY_SUFFICIENT',
  ROOM_TYPE_SUITABLE: 'ROOM_TYPE_SUITABLE',
  LUNCH_BREAK_PROTECTED: 'LUNCH_BREAK_PROTECTED',
  FACULTY_MAX_HOURS: 'FACULTY_MAX_HOURS'
};

export class ConstraintModel {
  /**
   * Validate all hard constraints for a single assignment candidate.
   */
  validateCandidateAssignment({
    dayOfWeek,
    slotId,
    facultyId,
    roomId,
    sectionId,
    subjectId,
    sessionType = 'LECTURE',
    currentEntries = [],
    ignoreEntryId = null,
    roomsMap = new Map(),
    sectionsMap = new Map(),
    subjectsMap = new Map(),
    facultyMap = new Map(),
    slotsMap = new Map(),
    blockKeys = null,
    lunchKeys = null,
    lunchWindow = null
  }) {
    // 0. Lunch break check
    const slot = slotsMap.get(slotId);
    if (slot && slot.isLunchBreak) {
      return {
        isValid: false,
        constraint: CONSTRAINT_TYPES.LUNCH_BREAK_PROTECTED,
        conflict: `Slot ${slotId} is reserved for lunch break.`
      };
    }

    // 0b. Time the section has reserved (lunch, mentoring, minor programme)
    if (blockKeys && blockKeys.has(`${sectionId}|${dayOfWeek}|${slotId}`)) {
      return {
        isValid: false,
        constraint: CONSTRAINT_TYPES.LUNCH_BREAK_PROTECTED,
        conflict: `Section ${sectionId} has reserved time on ${dayOfWeek} at slot ${slotId}.`
      };
    }

    // 0c. A section without a fixed lunch hour keeps at least one free slot inside the lunch window
    if (lunchWindow && lunchWindow.includes(slotId) && !(lunchKeys && lunchKeys.has(`${sectionId}|${dayOfWeek}`))) {
      const used = currentEntries.filter(e =>
        e.id !== ignoreEntryId &&
        e.sectionId === sectionId &&
        e.dayOfWeek === dayOfWeek &&
        lunchWindow.includes(e.slotId)
      ).length;
      if (used + 1 >= lunchWindow.length) {
        return {
          isValid: false,
          constraint: CONSTRAINT_TYPES.LUNCH_BREAK_PROTECTED,
          conflict: `Section ${sectionId} needs a free lunch hour on ${dayOfWeek}.`
        };
      }
    }

    // 1. Faculty conflict (No faculty double-booking)
    const facultyConflict = currentEntries.find(e =>
      e.id !== ignoreEntryId &&
      e.facultyId === facultyId &&
      e.dayOfWeek === dayOfWeek &&
      e.slotId === slotId
    );
    if (facultyConflict) {
      return {
        isValid: false,
        constraint: CONSTRAINT_TYPES.FACULTY_NO_DOUBLE_BOOKING,
        conflict: `Faculty ${facultyId} already scheduled on ${dayOfWeek} at slot ${slotId} (Entry: ${facultyConflict.id}).`
      };
    }

    // 2. Room conflict (No room double-booking)
    const roomConflict = currentEntries.find(e =>
      e.id !== ignoreEntryId &&
      e.roomId === roomId &&
      e.dayOfWeek === dayOfWeek &&
      e.slotId === slotId
    );
    if (roomConflict) {
      return {
        isValid: false,
        constraint: CONSTRAINT_TYPES.ROOM_NO_DOUBLE_BOOKING,
        conflict: `Room ${roomId} already booked on ${dayOfWeek} at slot ${slotId} (Entry: ${roomConflict.id}).`
      };
    }

    // 3. Section conflict (No student section double-booking)
    const sectionConflict = currentEntries.find(e =>
      e.id !== ignoreEntryId &&
      (e.sectionId === sectionId || (e.coSectionIds ?? []).includes(sectionId)) &&
      e.dayOfWeek === dayOfWeek &&
      e.slotId === slotId
    );
    if (sectionConflict) {
      return {
        isValid: false,
        constraint: CONSTRAINT_TYPES.SECTION_NO_DOUBLE_BOOKING,
        conflict: `Section ${sectionId} already has a class on ${dayOfWeek} at slot ${slotId} (Entry: ${sectionConflict.id}).`
      };
    }

    // 4. Room Capacity Check
    const room = roomsMap.get(roomId);
    const section = sectionsMap.get(sectionId);
    if (room && section && room.capacity < section.studentCount) {
      return {
        isValid: false,
        constraint: CONSTRAINT_TYPES.ROOM_CAPACITY_SUFFICIENT,
        conflict: `Room ${room.name || roomId} capacity (${room.capacity}) is insufficient for section ${section.name || sectionId} (${section.studentCount} students).`
      };
    }

    // 5. Room Type Suitability Check
    const subject = subjectsMap.get(subjectId);
    const isLab = sessionType === 'LAB' || (subject && subject.type === 'LAB');
    if (room && isLab && room.type !== 'LAB') {
      return {
        isValid: false,
        constraint: CONSTRAINT_TYPES.ROOM_TYPE_SUITABLE,
        conflict: `Subject ${subject ? subject.name : subjectId} requires a LAB room. ${room.name || roomId} is a ${room.type}.`
      };
    }

    return { isValid: true };
  }

  /**
   * Preflight feasibility checks to identify unsolvable conditions before generation.
   */
  preflightCheck({ subjects, faculty, rooms, sections }) {
    const errors = [];

    // Check room capacity for each section and subject
    for (const sec of sections) {
      const studentCount = sec.studentCount || 0;
      for (const sub of subjects) {
        const isLab = sub.type === 'LAB';
        const eligibleRooms = rooms.filter(r => {
          if (isLab && r.type !== 'LAB') return false;
          return (r.capacity || 0) >= studentCount;
        });

        if (eligibleRooms.length === 0) {
          const typeDesc = isLab ? 'lab' : 'lecture/tutorial';
          errors.push(
            `No ${typeDesc} room with capacity >= ${studentCount} exists for ${sub.code || sub.name} (section ${sec.name || sec.id}).`
          );
        }
      }
    }

    // Check faculty availability
    if (faculty.length === 0) {
      errors.push('No faculty members available for scheduling.');
    }

    if (rooms.length === 0) {
      errors.push('No rooms available for scheduling.');
    }

    if (errors.length > 0) {
      return {
        isFeasible: false,
        errors,
        status: 'INFEASIBLE',
        message: errors[0]
      };
    }

    return { isFeasible: true, status: 'FEASIBLE' };
  }

  /**
   * Comprehensive validation of an entire timetable.
   */
  validateFullTimetable(entries, { rooms = [], faculty = [], sections = [], subjects = [], timeSlots = [] }) {
    const roomsMap = new Map(rooms.map(r => [r.id, r]));
    const facultyMap = new Map(faculty.map(f => [f.id, f]));
    const sectionsMap = new Map(sections.map(s => [s.id, s]));
    const subjectsMap = new Map(subjects.map(sub => [sub.id, sub]));
    const slotsMap = new Map(timeSlots.map(ts => [ts.id, ts]));

    const conflicts = [];
    const facultySlotMap = new Map();
    const roomSlotMap = new Map();
    const sectionSlotMap = new Map();

    for (const entry of entries) {
      const key = `${entry.dayOfWeek}_${entry.slotId}`;

      // Faculty double booking
      const fKey = `${entry.facultyId}_${key}`;
      if (facultySlotMap.has(fKey)) {
        conflicts.push(`Faculty double-booking: Faculty ${entry.facultyId} scheduled multiple times on ${entry.dayOfWeek} at slot ${entry.slotId}.`);
      } else {
        facultySlotMap.set(fKey, entry.id);
      }

      // Room double booking
      const rKey = `${entry.roomId}_${key}`;
      if (roomSlotMap.has(rKey)) {
        conflicts.push(`Room double-booking: Room ${entry.roomId} booked multiple times on ${entry.dayOfWeek} at slot ${entry.slotId}.`);
      } else {
        roomSlotMap.set(rKey, entry.id);
      }

      // Section double booking
      const sKey = `${entry.sectionId}_${key}`;
      if (sectionSlotMap.has(sKey)) {
        conflicts.push(`Section double-booking: Section ${entry.sectionId} has multiple classes on ${entry.dayOfWeek} at slot ${entry.slotId}.`);
      } else {
        sectionSlotMap.set(sKey, entry.id);
      }

      // Room capacity
      const room = roomsMap.get(entry.roomId);
      const section = sectionsMap.get(entry.sectionId);
      if (room && section && room.capacity < section.studentCount) {
        conflicts.push(`Room capacity violation: Room ${room.name || entry.roomId} (${room.capacity}) < Section ${section.name || entry.sectionId} (${section.studentCount}).`);
      }

      // Room suitability
      const subject = subjectsMap.get(entry.subjectId);
      const isLab = entry.sessionType === 'LAB' || (subject && subject.type === 'LAB');
      if (room && isLab && room.type !== 'LAB') {
        conflicts.push(`Room suitability violation: Lab session for ${entry.subjectId} scheduled in non-lab room ${room.name || entry.roomId}.`);
      }

      // Lunch break
      const slot = slotsMap.get(entry.slotId);
      if (slot && slot.isLunchBreak) {
        conflicts.push(`Lunch break violation: Class scheduled during lunch slot ${entry.slotId}.`);
      }
    }

    return {
      isValid: conflicts.length === 0,
      conflictCount: conflicts.length,
      conflicts
    };
  }
}

export const constraintModel = new ConstraintModel();

