/**
 * TIMORA - Impact Analyzer
 * Performs targeted analysis of recorded disruptions against active timetable entries.
 * Distinguishes affected entries from preserved/unaffected entries.
 */

import { DISRUPTION_TYPES } from '../disruption/disruption-model.js';
import { timetableRepository } from '../../repositories/timetable-repository.js';

export class ImpactAnalyzer {
  /**
   * Analyze a disruption against current active timetable entries.
   */
  analyzeImpact(disruption, timetableEntries = null) {
    const entries = timetableEntries || timetableRepository.getActiveVersion().entries;

    const affectedEntries = [];
    const preservedEntries = [];

    entries.forEach(entry => {
      let isAffected = false;

      switch (disruption.disruptionType) {
        case DISRUPTION_TYPES.FACULTY_ABSENCE:
        case DISRUPTION_TYPES.FACULTY_UNAVAILABILITY:
          if (entry.facultyId === disruption.affectedEntityId && entry.dayOfWeek === disruption.dayOfWeek) {
            if (!disruption.slotId || entry.slotId === disruption.slotId) {
              isAffected = true;
            }
          }
          break;

        case DISRUPTION_TYPES.ROOM_UNAVAILABILITY:
          if (entry.roomId === disruption.affectedEntityId && entry.dayOfWeek === disruption.dayOfWeek) {
            if (!disruption.slotId || entry.slotId === disruption.slotId) {
              isAffected = true;
            }
          }
          break;

        case DISRUPTION_TYPES.CLASS_CANCELLATION:
          if (entry.id === disruption.affectedEntityId || 
             (entry.sectionId === disruption.affectedEntityId && entry.dayOfWeek === disruption.dayOfWeek && (!disruption.slotId || entry.slotId === disruption.slotId))) {
            isAffected = true;
          }
          break;

        case DISRUPTION_TYPES.HOLIDAY:
        case DISRUPTION_TYPES.INSTITUTIONAL_EVENT:
          if (entry.dayOfWeek === disruption.dayOfWeek) {
            if (!disruption.slotId || entry.slotId === disruption.slotId) {
              isAffected = true;
            }
          }
          break;

        case DISRUPTION_TYPES.SWAP_REQUEST:
        case DISRUPTION_TYPES.MAKEUP_SESSION:
          if (entry.id === disruption.affectedEntityId || 
             (entry.facultyId === disruption.affectedEntityId && entry.dayOfWeek === disruption.dayOfWeek && entry.slotId === disruption.slotId)) {
            isAffected = true;
          }
          break;

        default:
          if (entry.dayOfWeek === disruption.dayOfWeek && disruption.slotId === entry.slotId) {
            isAffected = true;
          }
          break;
      }

      if (isAffected) {
        affectedEntries.push({ ...entry, isAffected: true, isPreserved: false });
      } else {
        preservedEntries.push({ ...entry, isAffected: false, isPreserved: true });
      }
    });

    const affectedFacultyIds = [...new Set(affectedEntries.map(e => e.facultyId))];
    const affectedRoomIds = [...new Set(affectedEntries.map(e => e.roomId))];
    const affectedSectionIds = [...new Set(affectedEntries.map(e => e.sectionId))];
    const affectedSlotIds = [...new Set(affectedEntries.map(e => e.slotId))];

    return {
      disruptionId: disruption.id,
      disruptionType: disruption.disruptionType,
      dayOfWeek: disruption.dayOfWeek,
      totalEntries: entries.length,
      affectedCount: affectedEntries.length,
      preservedCount: preservedEntries.length,
      affectedEntries,
      preservedEntries,
      summary: {
        affectedFacultyIds,
        affectedRoomIds,
        affectedSectionIds,
        affectedSlotIds
      }
    };
  }
}

export const impactAnalyzer = new ImpactAnalyzer();
