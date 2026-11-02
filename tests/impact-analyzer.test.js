import test from 'node:test';
import assert from 'node:assert/strict';
import { impactAnalyzer } from '../src/adaptive/impact/impact-analyzer.js';
import { DISRUPTION_TYPES } from '../src/adaptive/disruption/disruption-model.js';
import { INITIAL_TIMETABLE_ENTRIES } from './support/fixtures.js';

test('Impact Analyzer - Faculty Absence affects specific entries and preserves others', () => {
  const disruption = {
    id: 'DIS_TEST_1',
    disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
    affectedEntityType: 'FACULTY',
    affectedEntityId: 'F101',
    dayOfWeek: 'Tuesday',
    slotId: 'S2'
  };

  const activeEntries = INITIAL_TIMETABLE_ENTRIES;
  const result = impactAnalyzer.analyzeImpact(disruption, activeEntries);

  assert.ok(result.affectedCount > 0);
  assert.equal(result.totalEntries, activeEntries.length);
  assert.equal(result.affectedCount + result.preservedCount, activeEntries.length);

  // Check affected entry properties
  result.affectedEntries.forEach(entry => {
    assert.equal(entry.facultyId, 'F101');
    assert.equal(entry.dayOfWeek, 'Tuesday');
    assert.equal(entry.slotId, 'S2');
    assert.equal(entry.isAffected, true);
    assert.equal(entry.isPreserved, false);
  });

  // Check preserved entries properties
  result.preservedEntries.forEach(entry => {
    assert.equal(entry.isPreserved, true);
  });
});

test('Impact Analyzer - Preserves all entries when no timetable entries match the disruption', () => {
  const disruption = {
    id: 'DIS_TEST_NO_MATCH',
    disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
    affectedEntityType: 'FACULTY',
    affectedEntityId: 'FACULTY_NOT_IN_TIMETABLE',
    dayOfWeek: 'Tuesday',
    slotId: 'S2'
  };

  const activeEntries = INITIAL_TIMETABLE_ENTRIES;
  const result = impactAnalyzer.analyzeImpact(disruption, activeEntries);

  assert.equal(result.affectedCount, 0);
  assert.equal(result.preservedCount, activeEntries.length);
  assert.equal(result.totalEntries, activeEntries.length);
  assert.equal(result.affectedEntries.length, 0);
  assert.equal(result.preservedEntries.length, activeEntries.length);

  result.preservedEntries.forEach(entry => {
    assert.equal(entry.isAffected, false);
    assert.equal(entry.isPreserved, true);
  });
});
