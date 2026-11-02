import test from 'node:test';
import assert from 'node:assert/strict';
import { Disruption, DISRUPTION_TYPES, DISRUPTION_STATUS } from '../src/adaptive/disruption/disruption-model.js';

test('Disruption model - builds a valid disruption with sensible defaults', () => {
  const disruption = new Disruption({
    disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
    affectedEntityType: 'FACULTY',
    affectedEntityId: 'F101',
    dayOfWeek: 'Tuesday',
    slotId: 'S2',
    reason: 'Medical leave'
  });

  assert.ok(disruption.id.startsWith('DIS_'));
  assert.equal(disruption.status, DISRUPTION_STATUS.RECORDED);
  assert.equal(disruption.slotId, 'S2');
});

test('Disruption model - normalises the day name and infers the entity type', () => {
  const disruption = new Disruption({
    disruptionType: DISRUPTION_TYPES.ROOM_UNAVAILABILITY,
    affectedEntityId: 'R201',
    dayOfWeek: 'wednesday'
  });

  assert.equal(disruption.dayOfWeek, 'Wednesday');
  assert.equal(disruption.affectedEntityType, 'ROOM');
});

test('Disruption model - rejects unknown types, days, slots and missing entities', () => {
  const valid = { disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE, affectedEntityId: 'F101', dayOfWeek: 'Tuesday' };

  assert.throws(() => new Disruption({ ...valid, disruptionType: 'ALIEN_INVASION' }), /Invalid disruption type/);
  assert.throws(() => new Disruption({ ...valid, dayOfWeek: 'Sunday' }), /valid day of the week/);
  assert.throws(() => new Disruption({ ...valid, slotId: 'S42' }), /Invalid time slot/);
  assert.throws(() => new Disruption({ ...valid, affectedEntityId: '' }), /affected entity ID/);
  assert.throws(() => new Disruption({ ...valid, reason: 'x'.repeat(501) }), /at most 500/);
});

test('Disruption model - a holiday needs no specific entity', () => {
  const holiday = new Disruption({ disruptionType: DISRUPTION_TYPES.HOLIDAY, dayOfWeek: 'Friday' });

  assert.equal(holiday.affectedEntityId, 'ALL');
  assert.equal(holiday.affectedEntityType, 'TIMETABLE');
});
