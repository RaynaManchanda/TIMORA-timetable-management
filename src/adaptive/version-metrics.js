/**
 * TIMORA - Metrics of a timetable version, shown on the dashboard and the analytics page.
 * Pure: computed from the entries and reference data passed in.
 */

import { TEACHING_DAYS, TIME_SLOTS } from '../constants/academic.js';
import { studentDayQualityEvaluator } from './scoring/student-day-evaluator.js';

/**
 * Identity of a class for comparing two versions (everything that matters to students and faculty).
 *
 * @param {object} entry Timetable entry (engine shape).
 * @returns {string}
 */
function classKey(entry) {
  return [entry.sectionId, entry.subjectId, entry.facultyId, entry.roomId, entry.dayOfWeek, entry.slotId, entry.sessionType].join('|');
}

/**
 * Compute the headline numbers of a version.
 *
 * @param {{ entries: object[], rooms: object[], parentEntries?: object[] | null }} input Entries of the version, the rooms, and the parent version's entries when known.
 * @returns {{ qualityScore: number, qualityBreakdown: object, avoidableGaps: number, averageGapPerStudentDay: number, scheduledClasses: number, roomUtilizationPercent: number, averageFacultyWorkloadHours: number, stabilityPercent: number }}
 */
export function computeVersionMetrics({ entries, rooms, parentEntries = null }) {
  const quality = studentDayQualityEvaluator.evaluateQuality(entries);

  const usedRoomSlots = new Set(entries.map((entry) => `${entry.roomId}|${entry.dayOfWeek}|${entry.slotId}`));
  const capacity = Math.max(1, rooms.length * TEACHING_DAYS.length * TIME_SLOTS.length);

  const hoursByFaculty = new Map();
  for (const slot of new Set(entries.map((entry) => `${entry.facultyId}|${entry.dayOfWeek}|${entry.slotId}`))) {
    const facultyId = slot.split('|')[0];
    hoursByFaculty.set(facultyId, (hoursByFaculty.get(facultyId) ?? 0) + 1);
  }
  const totalHours = [...hoursByFaculty.values()].reduce((sum, hours) => sum + hours, 0);

  let stabilityPercent = 100;
  if (parentEntries && parentEntries.length > 0) {
    const before = new Set(parentEntries.map(classKey));
    const unchanged = entries.filter((entry) => before.has(classKey(entry))).length;
    stabilityPercent = Math.round((unchanged / Math.max(entries.length, parentEntries.length)) * 100);
  }

  return {
    qualityScore: quality.overallQualityScore,
    qualityBreakdown: quality.breakdown,
    avoidableGaps: quality.totals.avoidableGaps,
    averageGapPerStudentDay: quality.totals.averageGapPerStudentDay,
    scheduledClasses: entries.length,
    roomUtilizationPercent: Math.round((usedRoomSlots.size / capacity) * 100),
    averageFacultyWorkloadHours: hoursByFaculty.size === 0 ? 0 : Math.round((totalHours / hoursByFaculty.size) * 10) / 10,
    stabilityPercent
  };
}
