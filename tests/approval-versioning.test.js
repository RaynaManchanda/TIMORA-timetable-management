import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalService } from '../src/adaptive/approval/approval-service.js';
import { versionService } from '../src/adaptive/versioning/version-service.js';
import { disruptionService } from '../src/adaptive/disruption/disruption-service.js';
import { DISRUPTION_TYPES } from '../src/adaptive/disruption/disruption-model.js';

test('Approval & Versioning - Approve alternative produces new immutable version and enables rollback', () => {
  // 1. Record disruption
  const disruption = disruptionService.recordDisruption({
    disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
    affectedEntityType: 'FACULTY',
    affectedEntityId: 'F101',
    dayOfWeek: 'Tuesday',
    slotId: 'S2'
  });

  const sampleAlt = {
    id: 'ALT_TEST_APP',
    name: 'Option 1: Substitute Hopper',
    changeCount: 1,
    modifiedEntries: [
      { subjectName: 'Database Systems', oldDay: 'Tuesday', oldSlot: 'S2', newDay: 'Tuesday', newSlot: 'S2' }
    ],
    fullTimetableEntries: [
      { id: 'E1001', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS501', facultyId: 'F102', roomId: 'R202', dayOfWeek: 'Tuesday', slotId: 'S2' }
    ]
  };

  const initialVersionCount = versionService.getVersionHistory().length;

  // 2. Execute Admin Approval
  const result = approvalService.approveAlternative({
    alternative: sampleAlt,
    disruptionId: disruption.id,
    approvedBy: 'Admin Test',
    approvalNotes: 'Approved for test'
  });

  assert.equal(result.status, 'SUCCESS');
  assert.ok(result.version.id);
  assert.equal(result.version.status, 'ACTIVE');

  // Check version history incremented
  const updatedHistory = versionService.getVersionHistory();
  assert.equal(updatedHistory.length, initialVersionCount + 1);

  // Check rollback capability
  const previousVersionId = updatedHistory[1].id;
  const rolledBack = versionService.rollbackToVersion(previousVersionId);
  assert.equal(rolledBack.id, previousVersionId);
  assert.equal(versionService.getActiveVersion().id, previousVersionId);
});
