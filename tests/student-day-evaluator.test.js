import test from 'node:test';
import assert from 'node:assert/strict';
import { studentDayQualityEvaluator } from '../src/adaptive/scoring/student-day-evaluator.js';

test('Student Day Evaluator - Returns score between 0 and 100 with breakdowns', () => {
  const sampleEntries = [
    { id: 'E1', sectionId: 'SEC_CSE_5A', dayOfWeek: 'Tuesday', slotId: 'S1' },
    { id: 'E2', sectionId: 'SEC_CSE_5A', dayOfWeek: 'Tuesday', slotId: 'S2' },
    { id: 'E3', sectionId: 'SEC_CSE_5A', dayOfWeek: 'Tuesday', slotId: 'S3' },
    { id: 'E4', sectionId: 'SEC_CSE_5A', dayOfWeek: 'Tuesday', slotId: 'S5' } // S4 is lunch break slot
  ];

  const result = studentDayQualityEvaluator.evaluateQuality(sampleEntries);

  assert.ok(result.overallQualityScore >= 0 && result.overallQualityScore <= 100);
  assert.ok(result.breakdown);
  assert.ok(result.breakdown.gapScore >= 0);
  assert.ok(result.breakdown.spanScore >= 0);
  assert.ok(result.breakdown.consecutiveScore >= 0);
  assert.ok(result.breakdown.balanceScore >= 0);
});

test('Student Day Evaluator - Penalizes > 3 consecutive back-to-back classes', () => {
  const heavyConsecutiveEntries = [
    { id: 'E1', sectionId: 'SEC_CSE_5A', dayOfWeek: 'Tuesday', slotId: 'S1' },
    { id: 'E2', sectionId: 'SEC_CSE_5A', dayOfWeek: 'Tuesday', slotId: 'S2' },
    { id: 'E3', sectionId: 'SEC_CSE_5A', dayOfWeek: 'Tuesday', slotId: 'S3' },
    { id: 'E4', sectionId: 'SEC_CSE_5A', dayOfWeek: 'Tuesday', slotId: 'S4' },
    { id: 'E5', sectionId: 'SEC_CSE_5A', dayOfWeek: 'Tuesday', slotId: 'S5' } // 5 consecutive slots!
  ];

  const result = studentDayQualityEvaluator.evaluateQuality(heavyConsecutiveEntries);
  assert.ok(result.breakdown.consecutiveScore < 100);
});
