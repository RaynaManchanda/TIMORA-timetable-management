/**
 * TIMORA - Student Day Quality Evaluator
 * Evaluates student-day quality score (0 - 100) based on schedule ergonomics:
 * - Gap Penalty: 35%
 * - Campus Span Penalty: 25%
 * - Consecutive Classes Penalty: 25%
 * - Daily Load Balance: 15%
 */

import { DAYS_OF_WEEK, TIME_SLOTS } from '../../repositories/timetable-repository.js';

export class StudentDayQualityEvaluator {
  /**
   * Evaluate student-day quality score for a list of timetable entries.
   */
  evaluateQuality(entries) {
    // Group entries by section and by day
    const sectionDayMap = {};

    entries.forEach(entry => {
      const key = `${entry.sectionId}_${entry.dayOfWeek}`;
      if (!sectionDayMap[key]) sectionDayMap[key] = [];
      sectionDayMap[key].push(entry);
    });

    let totalGapScore = 100;
    let totalSpanScore = 100;
    let totalConsecutiveScore = 100;
    let totalBalanceScore = 100;

    let dayEvaluationsCount = 0;

    // Helper map of slotId to slotNumber (1 to N)
    const slotNumberMap = new Map(TIME_SLOTS.map(ts => [ts.id, ts.slotNumber]));

    Object.entries(sectionDayMap).forEach(([key, dayEntries]) => {
      dayEvaluationsCount++;
      if (dayEntries.length === 0) return;

      // Sort slots by slot number
      const slotNumbers = dayEntries
        .map(e => slotNumberMap.get(e.slotId) || 1)
        .sort((a, b) => a - b);

      const minSlot = slotNumbers[0];
      const maxSlot = slotNumbers[slotNumbers.length - 1];

      // 1. Gap Penalty Calculation (35%)
      let unexcusedGaps = 0;
      for (let s = minSlot; s < maxSlot; s++) {
        if (!slotNumbers.includes(s)) {
          // Slot s is an empty gap. Check if it's a valid 1-slot lunch break at slot 4 (12:00-13:00)
          if (s === 4) {
            // Reasonable lunch break, no penalty
          } else {
            unexcusedGaps++;
          }
        }
      }
      totalGapScore -= (unexcusedGaps * 15);

      // 2. Campus Span Penalty (25%)
      const spanLength = (maxSlot - minSlot + 1);
      const activeClassCount = slotNumbers.length;
      const idleSpanGaps = spanLength - activeClassCount;
      if (idleSpanGaps > 2) {
        totalSpanScore -= (idleSpanGaps * 10);
      }

      // 3. Consecutive Classes Penalty (25%) - Penalize > 3 back-to-back classes
      let consecutiveCount = 1;
      let maxConsecutive = 1;
      for (let i = 1; i < slotNumbers.length; i++) {
        if (slotNumbers[i] === slotNumbers[i - 1] + 1) {
          consecutiveCount++;
          if (consecutiveCount > maxConsecutive) maxConsecutive = consecutiveCount;
        } else {
          consecutiveCount = 1;
        }
      }
      if (maxConsecutive > 3) {
        totalConsecutiveScore -= ((maxConsecutive - 3) * 20);
      }
    });

    // 4. Daily Load Balance (15%)
    // Check distribution of class counts across days for each section
    const sectionLoadMap = {};
    entries.forEach(entry => {
      if (!sectionLoadMap[entry.sectionId]) sectionLoadMap[entry.sectionId] = [];
      sectionLoadMap[entry.sectionId].push(entry);
    });

    Object.values(sectionLoadMap).forEach(secEntries => {
      const countsByDay = DAYS_OF_WEEK.map(day => secEntries.filter(e => e.dayOfWeek === day).length);
      const maxDay = Math.max(...countsByDay);
      const minDay = Math.min(...countsByDay.filter(c => c > 0));
      if (maxDay - minDay > 3) {
        totalBalanceScore -= 20;
      }
    });

    // Clamp scores to 0 - 100
    const gapScore = Math.max(0, Math.min(100, totalGapScore));
    const spanScore = Math.max(0, Math.min(100, totalSpanScore));
    const consecutiveScore = Math.max(0, Math.min(100, totalConsecutiveScore));
    const balanceScore = Math.max(0, Math.min(100, totalBalanceScore));

    // Weighted Total Score: 35% Gap + 25% Span + 25% Consecutive + 15% Balance
    const overallQualityScore = Math.round(
      (gapScore * 0.35) +
      (spanScore * 0.25) +
      (consecutiveScore * 0.25) +
      (balanceScore * 0.15)
    );

    return {
      overallQualityScore: Math.max(0, Math.min(100, overallQualityScore)),
      breakdown: {
        gapScore,
        spanScore,
        consecutiveScore,
        balanceScore
      }
    };
  }
}

export const studentDayQualityEvaluator = new StudentDayQualityEvaluator();
