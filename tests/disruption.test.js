import test from 'node:test';
import assert from 'node:assert/strict';
import { disruptionService } from '../src/adaptive/disruption/disruption-service.js';
import { DISRUPTION_TYPES, DISRUPTION_STATUS } from '../src/adaptive/disruption/disruption-model.js';

test('Disruption Service - Record & Retrieve Disruption', () => {
  const disruption = disruptionService.recordDisruption({
    disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
    affectedEntityType: 'FACULTY',
    affectedEntityId: 'F101',
    dayOfWeek: 'Tuesday',
    slotId: 'S2',
    reason: 'Medical leave'
  });

  assert.ok(disruption.id);
  assert.equal(disruption.disruptionType, DISRUPTION_TYPES.FACULTY_ABSENCE);
  assert.equal(disruption.status, DISRUPTION_STATUS.RECORDED);

  const retrieved = disruptionService.getDisruptionById(disruption.id);
  assert.equal(retrieved.id, disruption.id);
});

test('Disruption Service - Update Status', () => {
  const disruption = disruptionService.recordDisruption({
    disruptionType: DISRUPTION_TYPES.ROOM_UNAVAILABILITY,
    affectedEntityType: 'ROOM',
    affectedEntityId: 'R201',
    dayOfWeek: 'Wednesday',
    reason: 'Maintenance'
  });

  const updated = disruptionService.updateDisruptionStatus(disruption.id, DISRUPTION_STATUS.ANALYZED);
  assert.equal(updated.status, DISRUPTION_STATUS.ANALYZED);
});
