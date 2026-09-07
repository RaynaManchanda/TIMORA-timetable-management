/**
 * TIMORA - Scheduling Engine Adapter
 * Decoupled interface adapter for hard constraint validation.
 * Interoperable with the future `feature/scheduling-engine` module.
 */

import { timetableRepository } from '../repositories/timetable-repository.js';

export class SchedulingEngineAdapter {
  /**
   * Check if a faculty is available in a given day & slot without conflict.
   */
  checkFacultyAvailability(facultyId, day, slotId, currentEntries, ignoreEntryId = null) {
    const conflict = currentEntries.find(entry => 
      entry.id !== ignoreEntryId &&
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
   * Check if a room is available in a given day & slot without conflict.
   */
  checkRoomAvailability(roomId, day, slotId, currentEntries, ignoreEntryId = null) {
    const conflict = currentEntries.find(entry => 
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
   * Check if a student section/group is available in a given day & slot without conflict.
   */
  checkSectionAvailability(sectionId, day, slotId, currentEntries, ignoreEntryId = null) {
    const conflict = currentEntries.find(entry => 
      entry.id !== ignoreEntryId &&
      entry.sectionId === sectionId &&
      entry.dayOfWeek === day &&
      entry.slotId === slotId
    );
    return {
      isValid: !conflict,
      conflict: conflict ? `Section ${sectionId} already has a class in slot ${slotId} on ${day} (Entry ${conflict.id})` : null
    };
  }

  /**
   * Check room suitability (Lab subjects require LAB rooms; Lectures require CLASSROOM/LAB).
   */
  checkRoomSuitability(roomId, subjectId) {
    const room = timetableRepository.getRoomById(roomId);
    const subject = timetableRepository.getSubjectById(subjectId);

    if (!room || !subject) {
      return { isValid: true, warning: 'Room or subject metadata missing.' };
    }

    if (subject.type === 'LAB' && room.type !== 'LAB') {
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
  validateHardConstraints({ entry, targetDay, targetSlotId, targetRoomId, targetFacultyId, currentEntries }) {
    const day = targetDay || entry.dayOfWeek;
    const slotId = targetSlotId || entry.slotId;
    const roomId = targetRoomId || entry.roomId;
    const facultyId = targetFacultyId || entry.facultyId;
    const ignoreEntryId = entry.id;

    // 1. Faculty conflict
    const facultyCheck = this.checkFacultyAvailability(facultyId, day, slotId, currentEntries, ignoreEntryId);
    if (!facultyCheck.isValid) return facultyCheck;

    // 2. Room conflict
    const roomCheck = this.checkRoomAvailability(roomId, day, slotId, currentEntries, ignoreEntryId);
    if (!roomCheck.isValid) return roomCheck;

    // 3. Section conflict
    const sectionCheck = this.checkSectionAvailability(entry.sectionId, day, slotId, currentEntries, ignoreEntryId);
    if (!sectionCheck.isValid) return sectionCheck;

    // 4. Room suitability
    const suitabilityCheck = this.checkRoomSuitability(roomId, entry.subjectId);
    if (!suitabilityCheck.isValid) return suitabilityCheck;

    return { isValid: true };
  }
}

export const schedulingEngineAdapter = new SchedulingEngineAdapter();
