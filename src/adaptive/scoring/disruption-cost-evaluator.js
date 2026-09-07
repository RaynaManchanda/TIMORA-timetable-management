/**
 * TIMORA - Disruption Cost Evaluator
 * Calculates the disruption cost / change magnitude of a candidate timetable alternative.
 *
 * Formula:
 * Disruption Cost = (affected entries moved × 1)
 *                 + (unaffected entries moved × 10)
 *                 + (room changes × 2)
 *                 + (faculty swaps × 3)
 */

export class DisruptionCostEvaluator {
  calculateCost({ originalEntries, candidateEntries, affectedEntryIds }) {
    let affectedMoved = 0;
    let unaffectedMoved = 0;
    let roomChanges = 0;
    let facultySwaps = 0;

    const originalMap = new Map(originalEntries.map(e => [e.id, e]));

    candidateEntries.forEach(candidate => {
      const original = originalMap.get(candidate.id);
      if (!original) return;

      const slotMoved = (candidate.dayOfWeek !== original.dayOfWeek || candidate.slotId !== original.slotId);
      const roomChanged = candidate.roomId !== original.roomId;
      const facultyChanged = candidate.facultyId !== original.facultyId;

      if (slotMoved) {
        if (affectedEntryIds.includes(candidate.id)) {
          affectedMoved += 1;
        } else {
          unaffectedMoved += 1;
        }
      }

      if (roomChanged) roomChanges += 1;
      if (facultyChanged) facultySwaps += 1;
    });

    const totalCost = (affectedMoved * 1) + (unaffectedMoved * 10) + (roomChanges * 2) + (facultySwaps * 3);

    return {
      totalCost,
      breakdown: {
        affectedMoved,
        unaffectedMoved,
        roomChanges,
        facultySwaps
      }
    };
  }
}

export const disruptionCostEvaluator = new DisruptionCostEvaluator();
