/**
 * TIMORA - Approval Service
 * Manages human approval workflows for rescheduling decisions.
 * Rule: AI or system must NEVER auto-approve or auto-publish a timetable.
 */

import { versionService } from '../versioning/version-service.js';
import { disruptionService } from '../disruption/disruption-service.js';
import { DISRUPTION_STATUS } from '../disruption/disruption-model.js';

class ApprovalService {
  constructor() {
    this.approvalLogs = [];
  }

  approveAlternative({ alternative, disruptionId, approvedBy = 'Administrator', approvalNotes = '' }) {
    if (!alternative || !alternative.fullTimetableEntries) {
      throw new Error('Valid rescheduling alternative required for approval.');
    }

    if (!disruptionId) {
      throw new Error('Disruption ID is required to approve a rescheduling decision.');
    }

    // 1. Create new immutable timetable version
    const changeSummary = alternative.modifiedEntries.map(m => 
      `${m.subjectName || 'Class'}: ${m.oldDay} ${m.oldSlot} -> ${m.newDay} ${m.newSlotLabel || m.newSlot}`
    ).join('; ');

    const newVersion = versionService.createNewVersion({
      entries: alternative.fullTimetableEntries,
      disruptionId,
      approvedBy,
      name: `Approved: ${alternative.name}`,
      changeLog: `Approved alternative ${alternative.id}. Changes: ${changeSummary}. Notes: ${approvalNotes}`
    });

    // 2. Update disruption status to RESOLVED
    disruptionService.updateDisruptionStatus(disruptionId, DISRUPTION_STATUS.RESOLVED);

    // 3. Record audit log
    const auditRecord = {
      id: `APP_${Date.now()}`,
      disruptionId,
      alternativeId: alternative.id,
      approvedVersionId: newVersion.id,
      approvedBy,
      approvedAt: new Date().toISOString(),
      notes: approvalNotes
    };
    this.approvalLogs.push(auditRecord);

    return {
      status: 'SUCCESS',
      message: `Alternative ${alternative.id} approved by ${approvedBy}. Created version ${newVersion.versionNumber}.`,
      version: newVersion,
      auditRecord
    };
  }

  getApprovalHistory() {
    return [...this.approvalLogs];
  }
}

export const approvalService = new ApprovalService();
