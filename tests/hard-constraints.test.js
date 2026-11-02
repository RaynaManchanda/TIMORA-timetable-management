import test from 'node:test';
import assert from 'node:assert/strict';
import { schedulingEngineAdapter } from '../src/adapters/scheduling-engine-adapter.js';
import { FIXTURE_CONTEXT } from './support/fixtures.js';

test('Hard Constraints - Detect Faculty Double-Booking', () => {
  const currentEntries = [
    { id: 'E1', facultyId: 'F101', dayOfWeek: 'Tuesday', slotId: 'S2', roomId: 'R201', sectionId: 'SEC_CSE_5A' }
  ];

  const check = schedulingEngineAdapter.checkFacultyAvailability('F101', 'Tuesday', 'S2', currentEntries);
  assert.equal(check.isValid, false);
  assert.ok(check.conflict.includes('Faculty F101 already scheduled'));
});

test('Hard Constraints - Detect Room Double-Booking', () => {
  const currentEntries = [
    { id: 'E1', facultyId: 'F101', dayOfWeek: 'Tuesday', slotId: 'S2', roomId: 'R201', sectionId: 'SEC_CSE_5A' }
  ];

  const check = schedulingEngineAdapter.checkRoomAvailability('R201', 'Tuesday', 'S2', currentEntries);
  assert.equal(check.isValid, false);
  assert.ok(check.conflict.includes('Room R201 already occupied'));
});

test('Hard Constraints - Detect Room Suitability Conflict for Lab Subject', () => {
  // SUB_CS502 is DBMS Lab
  const check = schedulingEngineAdapter.checkRoomSuitability('R202', 'SUB_CS502', FIXTURE_CONTEXT); // R202 is CLASSROOM
  assert.equal(check.isValid, false);
  assert.ok(check.conflict.includes('requires a LAB room'));
});
