/**
 * Rayna Manchanda (240601) - Adaptive Rescheduling & AI Assistance: TC01 - TC13.
 *
 * One test per test case of "TIMORA_Rayna_testcases.pdf", named by its id. TC01 and TC05 use the real
 * services and PostgreSQL (run "npm run test:db:up" first); the rest call the modules directly.
 *
 *   npm run test:rayna
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Disruption, DISRUPTION_TYPES } from '../../src/adaptive/disruption/disruption-model.js';
import { impactAnalyzer } from '../../src/adaptive/impact/impact-analyzer.js';
import { reschedulingEngine } from '../../src/adaptive/rescheduling/rescheduling-engine.js';
import { alternativeComparator } from '../../src/adaptive/rescheduling/alternative-comparator.js';
import { aiAssistantService } from '../../src/ai/ai-assistant-service.js';
import { createDemoApp } from '../../tests/support/demo-app.js';
import { FIXTURE_CONTEXT, INITIAL_TIMETABLE_ENTRIES, SEED_FACULTY, SEED_SUBJECTS } from '../../tests/support/fixtures.js';

const { services, prisma, close } = await createDemoApp();
after(close);

const admin = { name: 'Academic Coordinator' };
const catalog = { faculty: SEED_FACULTY, subjects: SEED_SUBJECTS };
const facultyAbsence = (overrides = {}) => ({
  id: 'DIS_X',
  disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
  affectedEntityType: 'FACULTY',
  affectedEntityId: 'F101',
  dayOfWeek: 'Tuesday',
  slotId: 'S2',
  ...overrides
});

test('TC01 - Report a valid disruption', async () => {
  const recorded = await services.adaptiveService.recordDisruption(
    { disruptionType: 'FACULTY_ABSENCE', affectedEntityId: 'F101', dayOfWeek: 'Tuesday', slotId: 'S2' },
    admin
  );
  const fetched = await services.adaptiveService.getDisruption(recorded.id);

  assert.equal(fetched.id, recorded.id);
  assert.equal(fetched.disruptionType, 'FACULTY_ABSENCE');
  assert.equal(fetched.affectedEntityId, 'F101');
  assert.equal(fetched.dayOfWeek, 'Tuesday');
  assert.equal(fetched.slotId, 'S2');
});

test('TC02 - Reject a disruption with a missing affected entity ID', () => {
  assert.throws(
    () => new Disruption({ disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE, affectedEntityId: '', dayOfWeek: 'Tuesday' }),
    { message: 'Disruption requires an affected entity ID.' }
  );
});

test('TC03 - Analyze the impact of a faculty absence', () => {
  const result = impactAnalyzer.analyzeImpact(facultyAbsence(), INITIAL_TIMETABLE_ENTRIES);

  assert.ok(result.affectedCount > 0);
  assert.equal(result.affectedCount + result.preservedCount, INITIAL_TIMETABLE_ENTRIES.length);
  for (const entry of result.affectedEntries) {
    assert.equal(entry.facultyId, 'F101');
    assert.equal(entry.dayOfWeek, 'Tuesday');
    assert.equal(entry.slotId, 'S2');
    assert.equal(entry.isAffected, true);
  }
  for (const entry of result.preservedEntries) assert.equal(entry.isPreserved, true);
});

test('TC04 - Generate and rank alternative schedules', () => {
  const impact = impactAnalyzer.analyzeImpact(facultyAbsence(), INITIAL_TIMETABLE_ENTRIES);
  const alternatives = reschedulingEngine.generateAlternatives(
    { ...impact, disruptionId: 'DIS_X', disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE, dayOfWeek: 'Tuesday', slotId: 'S2', affectedEntityId: 'F101' },
    FIXTURE_CONTEXT
  );

  assert.ok(alternatives.length > 0);
  assert.equal(alternatives[0].rank, 1);
  for (let i = 1; i < alternatives.length; i += 1) {
    assert.ok(alternatives[i - 1].compositeScore >= alternatives[i].compositeScore, 'ordered by composite score');
  }
  const comparison = alternativeComparator.compareAlternatives(alternatives, { id: 'DIS_X', disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE });
  assert.equal(comparison.topRecommendation.isRecommended, true);
});

test('TC05 - Approve an alternative and create a new timetable version', async () => {
  const disruption = await services.adaptiveService.recordDisruption(
    { disruptionType: 'FACULTY_ABSENCE', affectedEntityId: 'F101', dayOfWeek: 'Tuesday', slotId: 'S2' },
    admin
  );
  const { comparisonPayload } = await services.adaptiveService.generateAlternatives(disruption.id);
  const chosen = comparisonPayload.rankedAlternatives[0];
  const before = await prisma.timetableVersion.findFirst({ where: { status: 'ACTIVE' } });

  const { version } = await services.adaptiveService.approveAlternative(
    { disruptionId: disruption.id, alternativeId: chosen.id, approvalNotes: 'Approved for the test' },
    admin
  );

  assert.equal(version.status, 'ACTIVE');
  assert.notEqual(version.id, before.id, 'a new version was created');
  assert.equal((await prisma.timetableVersion.findUnique({ where: { id: before.id } })).status, 'ARCHIVED');
  assert.equal((await services.adaptiveService.getDisruption(disruption.id)).status, 'RESOLVED');
  const record = await prisma.approvalLog.findFirst({ where: { disruptionId: disruption.id } });
  assert.equal(record.alternativeId, chosen.id);
  assert.equal(record.approvedBy, admin.name);
  assert.equal(record.notes, 'Approved for the test');
  assert.ok(record.approvedAt ?? record.createdAt, 'approval is time-stamped');

  const restored = await services.adaptiveService.rollbackToVersion(before.id);
  assert.equal(restored.id, before.id);
  assert.equal(restored.status, 'ACTIVE');
});

test('TC06 - Process a scheduling request using AI assistance', async () => {
  const interpreted = await aiAssistantService.interpretConstraint('Prof Turing is unavailable on Tuesday 10-12', catalog);
  assert.equal(interpreted.status, 'AWAITING_HUMAN_VALIDATION');
  assert.equal(interpreted.isValidated, false);

  const validated = aiAssistantService.validateConstraint(interpreted, { reason: 'Verified by Admin' });
  assert.equal(validated.status, 'VALIDATED');
  assert.equal(validated.validatedConstraint.isHumanValidated, true);

  const explanation = aiAssistantService.generateExplanation(
    {
      name: 'Option 1: Relocate to Tuesday S5',
      changeCount: 1,
      disruptionCost: 1,
      studentDayQualityScore: 92,
      modifiedEntries: [{ subjectName: 'Database Systems', oldDay: 'Tuesday', oldSlot: 'S2', newDay: 'Tuesday', newSlot: 'S5', newSlotLabel: '13:00 - 14:00' }]
    },
    { id: 'DIS1' }
  );
  for (const part of ['Option 1: Relocate to Tuesday S5', 'Database Systems', '100% hard-constraint compliant', '92/100']) {
    assert.ok(explanation.includes(part), `explanation mentions "${part}"`);
  }
});

test('TC07 - Reject an invalid disruption type', () => {
  assert.throws(
    () => new Disruption({ disruptionType: 'INVALID_TYPE', affectedEntityId: 'F101', dayOfWeek: 'Tuesday' }),
    { message: 'Invalid disruption type: INVALID_TYPE' }
  );
});

test('TC08 - Reject approval when no valid alternative is provided', async () => {
  const before = await prisma.timetableVersion.count();
  await assert.rejects(
    () => services.adaptiveService.approveAlternative({ disruptionId: 'DIS_ANY', alternativeId: null }, admin),
    { message: 'Valid rescheduling alternative required for approval.' }
  );
  assert.equal(await prisma.timetableVersion.count(), before, 'no timetable version was created');
});

test('TC09 - Reject approval when the disruption ID is missing', async () => {
  await assert.rejects(
    () => services.adaptiveService.approveAlternative({ disruptionId: '', alternativeId: 'ALT_1' }, admin),
    { message: 'Disruption ID is required to approve a rescheduling decision.' }
  );
});

test('TC10 - Preserve all entries when no timetable entries match the disruption', () => {
  const result = impactAnalyzer.analyzeImpact(facultyAbsence({ affectedEntityId: 'FACULTY_NOT_IN_TIMETABLE' }), INITIAL_TIMETABLE_ENTRIES);

  assert.equal(result.affectedCount, 0);
  assert.equal(result.preservedCount, INITIAL_TIMETABLE_ENTRIES.length);
  assert.equal(result.totalEntries, INITIAL_TIMETABLE_ENTRIES.length);
  for (const entry of result.preservedEntries) {
    assert.equal(entry.isAffected, false);
    assert.equal(entry.isPreserved, true);
  }
});

test('TC11 - Return No Changes Needed when no entries are affected', () => {
  const alternatives = reschedulingEngine.generateAlternatives(
    { disruptionId: 'DIS_NONE', disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE, dayOfWeek: 'Tuesday', affectedEntries: [], preservedEntries: INITIAL_TIMETABLE_ENTRIES },
    { ...FIXTURE_CONTEXT, activeEntries: INITIAL_TIMETABLE_ENTRIES }
  );

  assert.equal(alternatives.length, 1);
  assert.equal(alternatives[0].id, 'ALT_0');
  assert.equal(alternatives[0].name, 'No Changes Needed');
  assert.equal(alternatives[0].changeCount, 0);
  assert.equal(alternatives[0].rank, 1);
});

test('TC12 - Reject an empty AI prompt', async () => {
  await assert.rejects(() => aiAssistantService.interpretConstraint(''), { message: 'Natural language prompt text is required.' });
});

test('TC13 - Reject validation without an interpreted constraint', () => {
  assert.throws(() => aiAssistantService.validateConstraint(null), { message: 'Valid interpreted constraint result required for validation.' });
});
