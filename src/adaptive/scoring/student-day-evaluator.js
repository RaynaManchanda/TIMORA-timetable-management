/**
 * TIMORA - Student Day Quality Evaluator
 * Evaluates student-day quality score (0 - 100) based on schedule ergonomics:
 * - Gap Penalty: 35%
 * - Campus Span Penalty: 25%
 * - Consecutive Classes Penalty: 25%
 * - Daily Load Balance: 15%
 *
 * Every student day (one section on one day) is scored on its own and the scores are averaged,
 * so the result means the same for one section and for a whole college.
 */

import { DAYS_OF_WEEK, TIME_SLOTS } from '../../constants/academic.js';

/** Lunch is taken between 12:00 and 15:00 (slots 4 to 6); one empty slot there is not a gap. */
const LUNCH_WINDOW = Object.freeze({ first: 4, last: 6 });

/**
 * Average of a list of numbers (100 for an empty list).
 *
 * @param {number[]} values Numbers.
 * @returns {number}
 */
function average(values) {
  return values.length === 0 ? 100 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Clamp a score to 0 - 100.
 *
 * @param {number} value Score.
 * @returns {number}
 */
function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

export class StudentDayQualityEvaluator {
  /**
   * Evaluate student-day quality score for a list of timetable entries.
   *
   * @param {object[]} entries Timetable entries (engine shape).
   * @returns {{ overallQualityScore: number, breakdown: object }}
   */
  evaluateQuality(entries) {
    const slotNumberMap = new Map(TIME_SLOTS.map((slot) => [slot.id, slot.slotNumber]));

    // Occupied slot numbers per section and day; a combined class counts for every section in it.
    const sectionDays = new Map();
    for (const entry of entries) {
      for (const sectionId of [entry.sectionId, ...(entry.coSectionIds ?? [])]) {
        const key = `${sectionId}|${entry.dayOfWeek}`;
        if (!sectionDays.has(key)) sectionDays.set(key, { sectionId, slots: new Set() });
        sectionDays.get(key).slots.add(slotNumberMap.get(entry.slotId) || 1);
      }
    }

    const gapScores = [];
    let totalGaps = 0;
    const spanScores = [];
    const consecutiveScores = [];

    for (const { slots } of sectionDays.values()) {
      const slotNumbers = [...slots].sort((a, b) => a - b);
      const minSlot = slotNumbers[0];
      const maxSlot = slotNumbers[slotNumbers.length - 1];

      // 1. Gaps: an empty slot between classes, except one lunch hour inside the lunch window.
      let unexcusedGaps = 0;
      let lunchExcused = false;
      for (let s = minSlot; s < maxSlot; s += 1) {
        if (slots.has(s)) continue;
        if (!lunchExcused && s >= LUNCH_WINDOW.first && s <= LUNCH_WINDOW.last) {
          lunchExcused = true;
        } else {
          unexcusedGaps += 1;
        }
      }
      gapScores.push(clamp(100 - unexcusedGaps * 15));
      totalGaps += unexcusedGaps;

      // 2. Campus span: many idle slots between the first and last class.
      const idleSpanGaps = maxSlot - minSlot + 1 - slotNumbers.length;
      spanScores.push(clamp(idleSpanGaps > 2 ? 100 - idleSpanGaps * 10 : 100));

      // 3. Consecutive classes: penalise more than 3 back-to-back.
      let run = 1;
      let longestRun = 1;
      for (let i = 1; i < slotNumbers.length; i += 1) {
        run = slotNumbers[i] === slotNumbers[i - 1] + 1 ? run + 1 : 1;
        longestRun = Math.max(longestRun, run);
      }
      consecutiveScores.push(clamp(longestRun > 3 ? 100 - (longestRun - 3) * 20 : 100));
    }

    // 4. Daily load balance per section: a very uneven week is penalised.
    const loadBySection = new Map();
    for (const [key, { sectionId, slots }] of sectionDays) {
      const day = key.split('|')[1];
      if (!loadBySection.has(sectionId)) loadBySection.set(sectionId, new Map());
      loadBySection.get(sectionId).set(day, slots.size);
    }
    const balanceScores = [...loadBySection.values()].map((loadByDay) => {
      const counts = DAYS_OF_WEEK.map((day) => loadByDay.get(day) ?? 0).filter((count) => count > 0);
      return counts.length > 0 && Math.max(...counts) - Math.min(...counts) > 3 ? 80 : 100;
    });

    const gapScore = Math.round(average(gapScores));
    const spanScore = Math.round(average(spanScores));
    const consecutiveScore = Math.round(average(consecutiveScores));
    const balanceScore = Math.round(average(balanceScores));

    // Weighted total: 35% gaps + 25% span + 25% consecutive + 15% balance
    const overallQualityScore = Math.round(gapScore * 0.35 + spanScore * 0.25 + consecutiveScore * 0.25 + balanceScore * 0.15);

    return {
      overallQualityScore: clamp(overallQualityScore),
      breakdown: { gapScore, spanScore, consecutiveScore, balanceScore },
      totals: {
        avoidableGaps: totalGaps,
        studentDays: sectionDays.size,
        averageGapPerStudentDay: sectionDays.size === 0 ? 0 : Math.round((totalGaps / sectionDays.size) * 100) / 100
      }
    };
  }
}

export const studentDayQualityEvaluator = new StudentDayQualityEvaluator();
