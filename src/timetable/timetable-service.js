import { withTransaction } from '../db/transaction.js';
import { ConflictError, ForbiddenError } from '../errors/app-errors.js';
import { ROLES } from '../constants/roles.js';
import { createTimetableEntryRepository } from '../repositories/timetable-entry-repository.js';
import { createTimetableVersionRepository } from '../repositories/timetable-version-repository.js';
import {
  validateEntryPayload,
  validateTimetableQuery,
  validateVersionPayload
} from '../validation/timetable-validator.js';
import { generateId } from '../utils/id-generator.js';

/**
 * Create the timetable service: entry creation, section views and atomic version saves.
 *
 * @param {{ prisma: import('@prisma/client').PrismaClient }} dependencies Collaborators.
 */
export function createTimetableService({ prisma }) {
  const versionRepository = createTimetableVersionRepository(prisma);
  const entryRepository = createTimetableEntryRepository(prisma);

  /**
   * Restrict a student to the timetable of their own section.
   *
   * @param {object} user Authenticated user.
   * @param {{ sectionId?: string, day?: string }} filters Validated filters.
   * @returns {{ sectionId?: string, day?: string }} Filters safe to apply for this user.
   */
  function applyAccessScope(user, filters) {
    if (user.role !== ROLES.STUDENT) return filters;

    if (!user.sectionId) {
      throw new ForbiddenError('Your account is not assigned to a section.');
    }
    if (filters.sectionId && filters.sectionId !== user.sectionId) {
      throw new ForbiddenError('You can only view the timetable of your own section.');
    }
    return { ...filters, sectionId: user.sectionId };
  }

  return {
    /**
     * Add one entry to the active timetable version.
     * The database unique constraints reject room, faculty and section double booking.
     *
     * @param {object} body Raw entry request body.
     * @returns {Promise<object>} The stored entry.
     */
    async createEntry(body) {
      const entry = validateEntryPayload(body);

      const activeVersion = await versionRepository.findActive();
      if (!activeVersion) {
        throw new ConflictError('There is no active timetable version to add this entry to.');
      }

      return entryRepository.insert({ ...entry, id: generateId('E'), versionId: activeVersion.id });
    },

    /**
     * List entries of the active version, filtered by section and day, ordered by time slot.
     *
     * @param {{ section?: string, day?: string }} query Raw query parameters.
     * @param {object} user Authenticated user.
     * @returns {Promise<object[]>}
     */
    async listEntries(query, user) {
      const filters = applyAccessScope(user, validateTimetableQuery(query));
      return entryRepository.findInActiveVersion(filters);
    },

    /**
     * Save a new timetable version and all of its entries in one transaction.
     * If any entry fails, nothing is stored and the previous version stays active.
     *
     * @param {object} body Raw version request body.
     * @param {{ name: string }} approver User approving the version.
     * @returns {Promise<{ version: object, entriesCount: number }>}
     */
    async saveVersion(body, approver) {
      const input = validateVersionPayload(body);

      return withTransaction(prisma, async (tx) => {
        const versions = createTimetableVersionRepository(tx);
        const entries = createTimetableEntryRepository(tx);

        const previousVersion = await versions.findActive();
        const versionCount = await versions.count();
        await versions.archiveActive();

        const version = await versions.createActive({
          id: generateId('VER'),
          versionNumber: `v1.${versionCount}`,
          name: input.name,
          parentVersionId: previousVersion?.id,
          disruptionId: input.disruptionId,
          approvedBy: approver.name,
          changeLog: input.changeLog
        });

        for (const entry of input.entries) {
          await entries.insert({ ...entry, id: generateId('E'), versionId: version.id });
        }

        return { version, entriesCount: input.entries.length };
      });
    },

    /**
     * List all timetable versions, newest first.
     *
     * @returns {Promise<object[]>}
     */
    listVersions() {
      return versionRepository.findAll();
    }
  };
}
