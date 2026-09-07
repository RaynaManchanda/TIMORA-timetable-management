import test from 'node:test';
import assert from 'node:assert/strict';
import { disruptionCostEvaluator } from '../src/adaptive/scoring/disruption-cost-evaluator.js';

test('Disruption Cost Evaluator - Heavy Penalty for Unaffected Class Moves', () => {
  const originalEntries = [
    { id: 'E1001', dayOfWeek: 'Tuesday', slotId: 'S2', roomId: 'R202', facultyId: 'F101' },
    { id: 'E1002', dayOfWeek: 'Tuesday', slotId: 'S3', roomId: 'R201', facultyId: 'F101' }
  ];

  // Move affected entry E1001
  const candidateAffectedMove = [
    { id: 'E1001', dayOfWeek: 'Tuesday', slotId: 'S5', roomId: 'R202', facultyId: 'F101' },
    { id: 'E1002', dayOfWeek: 'Tuesday', slotId: 'S3', roomId: 'R201', facultyId: 'F101' }
  ];

  const costAffected = disruptionCostEvaluator.calculateCost({
    originalEntries,
    candidateEntries: candidateAffectedMove,
    affectedEntryIds: ['E1001']
  });

  assert.equal(costAffected.totalCost, 1); // 1 moved affected entry = cost 1

  // Move unaffected entry E1002 instead
  const candidateUnaffectedMove = [
    { id: 'E1001', dayOfWeek: 'Tuesday', slotId: 'S2', roomId: 'R202', facultyId: 'F101' },
    { id: 'E1002', dayOfWeek: 'Tuesday', slotId: 'S5', roomId: 'R201', facultyId: 'F101' }
  ];

  const costUnaffected = disruptionCostEvaluator.calculateCost({
    originalEntries,
    candidateEntries: candidateUnaffectedMove,
    affectedEntryIds: ['E1001']
  });

  assert.equal(costUnaffected.totalCost, 10); // 1 moved unaffected entry = cost 10
  assert.ok(costUnaffected.totalCost > costAffected.totalCost);
});
