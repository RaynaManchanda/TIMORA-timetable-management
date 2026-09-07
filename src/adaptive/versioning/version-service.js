/**
 * TIMORA - Timetable Version Service
 * Manages immutable timetable versions, change audit logs, parent version references, and rollbacks.
 */

import { timetableRepository } from '../../repositories/timetable-repository.js';

class VersionService {
  getActiveVersion() {
    return timetableRepository.getActiveVersion();
  }

  getVersionHistory() {
    return timetableRepository.getAllVersions();
  }

  getVersionById(id) {
    return timetableRepository.getVersionById(id);
  }

  createNewVersion({ entries, disruptionId, approvedBy, name, changeLog }) {
    if (!entries || !Array.isArray(entries)) {
      throw new Error('Valid timetable entries required to create a version.');
    }

    return timetableRepository.createVersion({
      entries,
      disruptionId,
      approvedBy,
      name,
      changeLog
    });
  }

  rollbackToVersion(versionId) {
    return timetableRepository.rollbackToVersion(versionId);
  }
}

export const versionService = new VersionService();
