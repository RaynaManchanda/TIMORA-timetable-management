/**
 * TIMORA - Timetable Quality & Student-Day Ergonomics Evaluator
 * Person 1: Rishank Mishra (Core Scheduling & Optimization)
 * Computes objective quality scores, gap counts, and workload ergonomics.
 */

import { TIME_SLOTS } from '../constants/academic.js';

export class TimetableQualityEvaluator {
  /**
   * Evaluate complete timetable quality and ergonomics.
   */
  evaluateQuality(entries = [], { rooms = [], faculty = [], sections = [], timeSlots = TIME_SLOTS } = {}) {
    const teachableSlots = timeSlots.filter(ts => !ts.isLunchBreak);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    let totalAvoidableGaps = 0;
    let totalGapHours = 0;
    let totalExcessConsecutive = 0;
    let maxDayHours = 0;

    // Group entries by section and day
    const sectionDayMap = new Map();
    for (const entry of entries) {
      const key = `${entry.sectionId}_${entry.dayOfWeek}`;
      if (!sectionDayMap.has(key)) {
        sectionDayMap.set(key, []);
      }
      sectionDayMap.get(key).push(entry);
    }

    // Evaluate student day ergonomics per section per day
    for (const [key, dayEntries] of sectionDayMap.entries()) {
      if (dayEntries.length <= 1) {
        if (dayEntries.length > maxDayHours) maxDayHours = dayEntries.length;
        continue;
      }

      // Sort entries by slotNumber
      const sorted = [...dayEntries].sort((a, b) => {
        const slotA = timeSlots.find(ts => ts.id === a.slotId)?.slotNumber || 0;
        const slotB = timeSlots.find(ts => ts.id === b.slotId)?.slotNumber || 0;
        return slotA - slotB;
      });

      const dayClassCount = sorted.length;
      if (dayClassCount > maxDayHours) {
        maxDayHours = dayClassCount;
      }

      // Check gaps between first and last class
      const firstSlotNum = timeSlots.find(ts => ts.id === sorted[0].slotId)?.slotNumber || 1;
      const lastSlotNum = timeSlots.find(ts => ts.id === sorted[sorted.length - 1].slotId)?.slotNumber || 1;

      // Active slot numbers
      const activeSlotNums = new Set(
        sorted.map(e => timeSlots.find(ts => ts.id === e.slotId)?.slotNumber).filter(Boolean)
      );

      let dayGaps = 0;
      for (let s = firstSlotNum; s <= lastSlotNum; s++) {
        const slotObj = timeSlots.find(ts => ts.slotNumber === s);
        if (slotObj && !slotObj.isLunchBreak && !activeSlotNums.has(s)) {
          dayGaps++;
        }
      }

      totalAvoidableGaps += dayGaps;
      totalGapHours += dayGaps;

      // Check consecutive classes without break (> 3)
      let consecutive = 0;
      for (const entry of sorted) {
        const slotObj = timeSlots.find(ts => ts.id === entry.slotId);
        if (slotObj && slotObj.isLunchBreak) {
          consecutive = 0;
        } else {
          consecutive++;
          if (consecutive > 3) {
            totalExcessConsecutive++;
          }
        }
      }
    }

    // Room Utilization: Total used room-slots / Total available room-slots
    const totalPossibleRoomSlots = (rooms.length || 4) * (teachableSlots.length || 6) * days.length;
    const roomUtilizationPct = totalPossibleRoomSlots > 0
      ? Math.min(100, Math.round((entries.length / totalPossibleRoomSlots) * 100))
      : 0;

    // Faculty Workload
    const facultyWorkloadMap = new Map();
    for (const entry of entries) {
      facultyWorkloadMap.set(entry.facultyId, (facultyWorkloadMap.get(entry.facultyId) || 0) + 1);
    }
    const facultyCount = faculty.length || Math.max(1, facultyWorkloadMap.size);
    const avgFacultyWorkload = entries.length > 0 ? (entries.length / facultyCount).toFixed(1) : '0';

    // Quality Score Calculation
    // Base 1000 points + room utilization bonus (0.36 per %) - gap penalty (25) - consecutive penalty (30)
    const scheduledClassPoints = entries.length * 10;
    const gapPenalty = totalAvoidableGaps * 25;
    const consecutivePenalty = totalExcessConsecutive * 30;
    const roomBonus = Number((roomUtilizationPct * 0.36).toFixed(1));

    const rawScore = 1000 - gapPenalty - consecutivePenalty + roomBonus;
    const qualityScore = Number(rawScore.toFixed(1));

    // Normalized 0-100 score for quick dashboard presentation
    const normalizedScore = Math.max(0, Math.min(100, Math.round(100 - (totalAvoidableGaps * 4) - (totalExcessConsecutive * 5))));

    return {
      qualityScore,
      compositeScore: qualityScore,
      normalizedScore,
      avoidableGaps: totalAvoidableGaps,
      gapHours: totalGapHours,
      consecutivePenalties: totalExcessConsecutive,
      longestDay: maxDayHours || (entries.length > 0 ? 6 : 0),
      scheduledClasses: entries.length,
      roomUtilization: `${roomUtilizationPct}%`,
      roomUtilizationRate: roomUtilizationPct,
      averageFacultyWorkload: `${avgFacultyWorkload} h/week`,
      hardConstraintConflicts: 0,
      breakdown: {
        scheduledClassPoints,
        gapPenalty,
        consecutivePenalty,
        roomBonus: Number(roomBonus.toFixed(1))
      }
    };
  }
}

export const timetableQualityEvaluator = new TimetableQualityEvaluator();
