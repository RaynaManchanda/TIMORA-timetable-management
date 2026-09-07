import test from 'node:test';
import assert from 'node:assert/strict';
import { reschedulingEngine } from '../src/adaptive/rescheduling/rescheduling-engine.js';
import { alternativeComparator } from '../src/adaptive/rescheduling/alternative-comparator.js';
import { DISRUPTION_TYPES } from '../src/adaptive/disruption/disruption-model.js';

test('Alternative Generation & Ranking - Generate sorted alternatives for impact', () => {
  const impactResult = {
    disruptionId: 'DIS_TEST_RANKING',
    disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
    dayOfWeek: 'Tuesday',
    affectedEntries: [
      { id: 'E1001', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS501', facultyId: 'F101', roomId: 'R202', dayOfWeek: 'Tuesday', slotId: 'S2' }
    ],
    preservedEntries: [
      { id: 'E1003', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS503', facultyId: 'F102', roomId: 'R202', dayOfWeek: 'Tuesday', slotId: 'S5' }
    ]
  };

  const alternatives = reschedulingEngine.generateAlternatives(impactResult);

  assert.ok(alternatives.length > 0);
  assert.equal(alternatives[0].rank, 1);
  assert.ok(alternatives[0].compositeScore >= alternatives[alternatives.length - 1].compositeScore);

  const comparison = alternativeComparator.compareAlternatives(alternatives, { id: 'DIS_TEST_RANKING', disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE });
  assert.equal(comparison.optionsCount, alternatives.length);
  assert.ok(comparison.topRecommendation);
  assert.equal(comparison.topRecommendation.isRecommended, true);
});
