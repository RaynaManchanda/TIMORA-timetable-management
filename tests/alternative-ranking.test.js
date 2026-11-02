import test from 'node:test';
import assert from 'node:assert/strict';
import { reschedulingEngine } from '../src/adaptive/rescheduling/rescheduling-engine.js';
import { alternativeComparator } from '../src/adaptive/rescheduling/alternative-comparator.js';
import { DISRUPTION_TYPES } from '../src/adaptive/disruption/disruption-model.js';
import { FIXTURE_CONTEXT, INITIAL_TIMETABLE_ENTRIES } from './support/fixtures.js';

test('Alternative Generation & Ranking - Generate sorted alternatives for impact', () => {
  const impactResult = {
    disruptionId: 'DIS_TEST_RANKING',
    disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
    dayOfWeek: 'Tuesday',
    slotId: 'S2',
    affectedEntityId: 'F101',
    affectedEntries: [
      { id: 'E1001', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS501', facultyId: 'F101', roomId: 'R202', dayOfWeek: 'Tuesday', slotId: 'S2' }
    ],
    preservedEntries: [
      { id: 'E1003', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS503', facultyId: 'F102', roomId: 'R202', dayOfWeek: 'Tuesday', slotId: 'S5' }
    ]
  };

  const alternatives = reschedulingEngine.generateAlternatives(impactResult, FIXTURE_CONTEXT);

  assert.ok(alternatives.length > 0);
  assert.equal(alternatives[0].rank, 1);
  assert.ok(alternatives[0].compositeScore >= alternatives[alternatives.length - 1].compositeScore);

  const comparison = alternativeComparator.compareAlternatives(alternatives, { id: 'DIS_TEST_RANKING', disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE });
  assert.equal(comparison.optionsCount, alternatives.length);
  assert.ok(comparison.topRecommendation);
  assert.equal(comparison.topRecommendation.isRecommended, true);
});

test('Alternative Generation - Returns No Changes Needed when no entries are affected', () => {
  const activeEntries = INITIAL_TIMETABLE_ENTRIES;

  const impactResult = {
    disruptionId: 'DIS_TEST_NO_IMPACT',
    disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
    dayOfWeek: 'Tuesday',
    affectedEntries: [],
    preservedEntries: activeEntries
  };

  const alternatives = reschedulingEngine.generateAlternatives(impactResult, { ...FIXTURE_CONTEXT, activeEntries });

  assert.equal(alternatives.length, 1);
  assert.equal(alternatives[0].id, 'ALT_0');
  assert.equal(alternatives[0].name, 'No Changes Needed');
  assert.equal(alternatives[0].changeCount, 0);
  assert.equal(alternatives[0].rank, 1);
  assert.equal(alternatives[0].hardConstraintCompliance, true);
  assert.equal(alternatives[0].fullTimetableEntries, activeEntries);
});