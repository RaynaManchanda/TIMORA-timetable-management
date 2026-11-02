/**
 * TIMORA - Impact Analyzer
 * Performs targeted analysis of recorded disruptions against active timetable entries.
 * Distinguishes affected entries from preserved/unaffected entries.
 *
 * The analyser is pure: the caller passes the entries of the active timetable.
 */

import { DISRUPTION_TYPES } from '../disruption/disruption-model.js';
import { sectionsOf } from '../../adapters/scheduling-engine-adapter.js';

/**
 * Check whether an entry is on the disruption's day and (when given) slot.
 *
 * @param {object} entry Timetable entry.
 * @param {object} disruption Disruption.
 * @returns {boolean}
 */
function isOnDisruptedTime(entry, disruption) {
  return entry.dayOfWeek === disruption.dayOfWeek && (!disruption.slotId || entry.slotId === disruption.slotId);
}

export class ImpactAnalyzer {
  /**
   * Analyze a disruption against the current active timetable entries.
   *
   * @param {object} disruption Recorded disruption.
   * @param {object[]} entries Entries of the active timetable (engine shape).
   * @returns {object} Impact result.
   */
  analyzeImpact(disruption, entries) {
    if (!Array.isArray(entries)) {
      throw new Error('The active timetable entries are required to analyse a disruption.');
    }

    const affectedEntries = [];
    const preservedEntries = [];

    entries.forEach((entry) => {
      let isAffected = false;

      switch (disruption.disruptionType) {
        case DISRUPTION_TYPES.FACULTY_ABSENCE:
        case DISRUPTION_TYPES.FACULTY_UNAVAILABILITY:
          isAffected = entry.facultyId === disruption.affectedEntityId && isOnDisruptedTime(entry, disruption);
          break;

        case DISRUPTION_TYPES.ROOM_UNAVAILABILITY:
          isAffected = entry.roomId === disruption.affectedEntityId && isOnDisruptedTime(entry, disruption);
          break;

        case DISRUPTION_TYPES.CLASS_CANCELLATION:
          isAffected =
            entry.id === disruption.affectedEntityId ||
            (sectionsOf(entry).includes(disruption.affectedEntityId) && isOnDisruptedTime(entry, disruption));
          break;

        case DISRUPTION_TYPES.HOLIDAY:
        case DISRUPTION_TYPES.INSTITUTIONAL_EVENT:
          isAffected = isOnDisruptedTime(entry, disruption);
          break;

        case DISRUPTION_TYPES.SWAP_REQUEST:
        case DISRUPTION_TYPES.MAKEUP_SESSION:
          isAffected =
            entry.id === disruption.affectedEntityId ||
            (entry.facultyId === disruption.affectedEntityId &&
              entry.dayOfWeek === disruption.dayOfWeek &&
              entry.slotId === disruption.slotId);
          break;

        default:
          isAffected = entry.dayOfWeek === disruption.dayOfWeek && disruption.slotId === entry.slotId;
          break;
      }

      if (isAffected) {
        affectedEntries.push({ ...entry, isAffected: true, isPreserved: false });
      } else {
        preservedEntries.push({ ...entry, isAffected: false, isPreserved: true });
      }
    });

    return {
      disruptionId: disruption.id,
      disruptionType: disruption.disruptionType,
      dayOfWeek: disruption.dayOfWeek,
      slotId: disruption.slotId ?? null,
      affectedEntityId: disruption.affectedEntityId,
      totalEntries: entries.length,
      affectedCount: affectedEntries.length,
      preservedCount: preservedEntries.length,
      affectedEntries,
      preservedEntries,
      summary: {
        affectedFacultyIds: [...new Set(affectedEntries.map((e) => e.facultyId))],
        affectedRoomIds: [...new Set(affectedEntries.map((e) => e.roomId))],
        affectedSectionIds: [...new Set(affectedEntries.flatMap(sectionsOf))],
        affectedSlotIds: [...new Set(affectedEntries.map((e) => e.slotId))]
      }
    };
  }
}

export const impactAnalyzer = new ImpactAnalyzer();
