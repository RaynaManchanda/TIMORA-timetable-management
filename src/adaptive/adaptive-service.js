/**
 * TIMORA - Adaptive rescheduling service
 *
 * Orchestrates the pure rescheduling modules against the database:
 * record a disruption -> analyse its impact -> propose alternatives -> a human approves one ->
 * a new timetable version is created (and can be rolled back).
 *
 * The AI and the engine only ever PROPOSE. Nothing changes the active timetable until an
 * administrator approves a specific alternative, and the approved timetable is rebuilt on the
 * server, never taken from the client.
 */

import { withTransaction } from '../db/transaction.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/app-errors.js';
import { generateId } from '../utils/id-generator.js';
import { DISRUPTION_STATUS } from '../constants/statuses.js';
import { createAcademicRepository } from '../repositories/academic-repository.js';
import { createDisruptionRepository } from '../repositories/disruption-repository.js';
import { createTimetableEntryRepository } from '../repositories/timetable-entry-repository.js';
import { createTimetableVersionRepository } from '../repositories/timetable-version-repository.js';
import { fromEngineEntry } from '../repositories/entry-mappers.js';
import { sectionsOf } from '../adapters/scheduling-engine-adapter.js';
import { Disruption } from './disruption/disruption-model.js';
import { impactAnalyzer } from './impact/impact-analyzer.js';
import { reschedulingEngine, buildBlockKeys } from './rescheduling/rescheduling-engine.js';
import { alternativeComparator } from './rescheduling/alternative-comparator.js';
import { aiAssistantService } from '../ai/ai-assistant-service.js';
import { computeVersionMetrics } from './version-metrics.js';

/**
 * Create the adaptive rescheduling service.
 *
 * @param {{ prisma: import('@prisma/client').PrismaClient, notificationService: object }} dependencies Collaborators.
 */
export function createAdaptiveService({ prisma, notificationService }) {
  const disruptions = createDisruptionRepository(prisma);
  const versions = createTimetableVersionRepository(prisma);
  const entries = createTimetableEntryRepository(prisma);
  const academic = createAcademicRepository(prisma);

  /**
   * Everything the engines need: the active timetable plus the reference data.
   *
   * @returns {Promise<object>}
   */
  async function loadContext() {
    const activeVersion = await versions.findActive();
    if (!activeVersion) throw new ConflictError('There is no active timetable version.');

    const [activeEntries, rooms, faculty, subjects, timeSlots, blocks] = await Promise.all([
      entries.findForEngine(activeVersion.id),
      academic.listRooms(),
      academic.listFaculty(),
      academic.listSubjects(),
      academic.listTimeSlots(),
      academic.listBlocks()
    ]);

    return { activeVersion, activeEntries, rooms, faculty, subjects, timeSlots, blocks, blockKeys: buildBlockKeys(blocks) };
  }

  /**
   * Load a disruption or fail with 404.
   */
  async function requireDisruption(id) {
    const disruption = await disruptions.findById(id);
    if (!disruption) throw new NotFoundError('Disruption not found.');
    return disruption;
  }

  /**
   * Analyse a disruption and produce ranked alternatives (nothing is stored).
   */
  async function propose(disruption) {
    const context = await loadContext();
    const impactResult = impactAnalyzer.analyzeImpact(disruption, context.activeEntries);
    const alternatives = reschedulingEngine.generateAlternatives(impactResult, context);

    for (const alternative of alternatives) {
      alternative.explanation = aiAssistantService.generateExplanation(alternative, disruption);
    }
    return { context, impactResult, alternatives };
  }

  /**
   * Check that the disruption refers to something that exists.
   */
  async function assertEntityExists(disruption) {
    const checks = {
      FACULTY: async () => (await academic.listFaculty()).some((person) => person.id === disruption.affectedEntityId),
      ROOM: async () => (await academic.listRooms()).some((room) => room.id === disruption.affectedEntityId),
      SECTION: async () => (await academic.listSections()).some((section) => section.id === disruption.affectedEntityId)
    };
    const check = checks[disruption.affectedEntityType];
    if (check && !(await check())) {
      throw new ValidationError(`Unknown ${disruption.affectedEntityType.toLowerCase()}: ${disruption.affectedEntityId}`);
    }
  }

  return {
    /**
     * Record a disruption reported by an administrator.
     *
     * @param {object} body Raw request body.
     * @param {{ name: string }} reporter User reporting it.
     * @returns {Promise<object>}
     */
    async recordDisruption(body, reporter) {
      let disruption;
      try {
        disruption = new Disruption({ ...body, id: undefined, status: undefined, reportedBy: reporter.name });
      } catch (error) {
        throw new ValidationError(error.message);
      }
      await assertEntityExists(disruption);
      return disruptions.create(disruption);
    },

    listDisruptions: () => disruptions.findAll(),

    getDisruption: requireDisruption,

    /**
     * Run the impact analysis of a disruption and mark it ANALYZED.
     */
    async analyzeDisruption(id) {
      const disruption = await requireDisruption(id);
      const context = await loadContext();
      const impactResult = impactAnalyzer.analyzeImpact(disruption, context.activeEntries);
      if (disruption.status === DISRUPTION_STATUS.RECORDED) {
        await disruptions.updateStatus(id, DISRUPTION_STATUS.ANALYZED);
      }
      return impactResult;
    },

    /**
     * Propose ranked alternatives for a disruption.
     */
    async generateAlternatives(disruptionId) {
      const disruption = await requireDisruption(disruptionId);
      if (disruption.status === DISRUPTION_STATUS.RESOLVED) {
        throw new ConflictError('This disruption has already been resolved.');
      }

      const { impactResult, alternatives } = await propose(disruption);
      if (disruption.status === DISRUPTION_STATUS.RECORDED) {
        await disruptions.updateStatus(disruptionId, DISRUPTION_STATUS.ANALYZED);
      }
      return { impactResult, comparisonPayload: alternativeComparator.compareAlternatives(alternatives, disruption) };
    },

    /**
     * Side-by-side comparison of the alternatives for a disruption.
     */
    async compareAlternatives(disruptionId) {
      const disruption = await requireDisruption(disruptionId);
      const { alternatives } = await propose(disruption);
      return alternativeComparator.compareAlternatives(alternatives, disruption);
    },

    /**
     * Approve one alternative. The alternative is regenerated on the server from the current
     * timetable, so a client cannot submit an arbitrary timetable; if the timetable changed since
     * the alternatives were shown, the approval is refused and must be repeated.
     *
     * @param {{ disruptionId: string, alternativeId: string, approvalNotes?: string }} body Approval request.
     * @param {{ name: string }} approver The approving administrator.
     */
    async approveAlternative({ disruptionId, alternativeId, approvalNotes = '' }, approver) {
      if (!disruptionId) throw new ValidationError('Disruption ID is required to approve a rescheduling decision.');
      if (!alternativeId) throw new ValidationError('Valid rescheduling alternative required for approval.');
      if (String(approvalNotes).length > 1000) throw new ValidationError('approvalNotes must be at most 1000 characters.');

      const disruption = await requireDisruption(disruptionId);
      if (disruption.status === DISRUPTION_STATUS.RESOLVED) {
        throw new ConflictError('This disruption has already been resolved.');
      }

      const { context, alternatives } = await propose(disruption);
      const alternative = alternatives.find((candidate) => candidate.id === alternativeId);
      if (!alternative) {
        throw new ConflictError('The timetable has changed since these alternatives were generated. Please generate them again.');
      }

      const changeSummary = alternative.modifiedEntries
        .map((m) => `${m.subjectName || 'Class'}: ${m.oldDay} ${m.oldSlot} -> ${m.newDay} ${m.newSlotLabel || m.newSlot}`)
        .join('; ');

      const { version, auditId } = await withTransaction(prisma, async (tx) => {
        const versionRepo = createTimetableVersionRepository(tx);
        const previous = await versionRepo.findActive();
        if (!previous || previous.id !== context.activeVersion.id) {
          throw new ConflictError('The active timetable changed while approving. Please generate the alternatives again.');
        }
        const versionCount = await versionRepo.count();
        await versionRepo.archiveActive();

        const created = await versionRepo.createActive({
          id: generateId('VER'),
          versionNumber: `v1.${versionCount}`,
          name: `Approved: ${alternative.name}`,
          parentVersionId: previous.id,
          disruptionId,
          approvedBy: approver.name,
          changeLog: `Approved alternative ${alternative.id}. Changes: ${changeSummary}. Notes: ${approvalNotes}`.slice(0, 4000),
          qualityScore: alternative.studentDayQualityScore
        });

        await createTimetableEntryRepository(tx).insertMany(
          alternative.fullTimetableEntries.map((entry) => fromEngineEntry(entry, created.id, () => generateId('E')))
        );

        const disruptionRepo = createDisruptionRepository(tx);
        await disruptionRepo.updateStatus(disruptionId, DISRUPTION_STATUS.RESOLVED);
        const audit = await disruptionRepo.createApprovalLog({
          id: generateId('APP'),
          disruptionId,
          alternativeId: alternative.id,
          approvedVersionId: created.id,
          approvedBy: approver.name,
          notes: approvalNotes
        });
        return { version: created, auditId: audit.id };
      });

      const notifications = await notifyAffectedUsers(notificationService, alternative, context.activeEntries);

      return {
        status: 'SUCCESS',
        message: `Alternative ${alternative.id} approved by ${approver.name}. Created version ${version.versionNumber}.`,
        version,
        activeVersion: version,
        auditId,
        notifications
      };
    },

    /**
     * Active version with its entries, plus the history. Administrators also get the headline metrics.
     *
     * @param {{ withMetrics?: boolean }} [options] withMetrics adds dashboard metrics to the active version.
     */
    async getVersionOverview({ withMetrics = false } = {}) {
      const [activeVersion, history] = await Promise.all([versions.findActive(), versions.findAll()]);
      if (!activeVersion) throw new NotFoundError('There is no active timetable version.');
      const activeEntries = await entries.findForEngine(activeVersion.id);

      let metrics;
      if (withMetrics) {
        const [rooms, parentEntries] = await Promise.all([
          academic.listRooms(),
          activeVersion.parentVersionId ? entries.findForEngine(activeVersion.parentVersionId) : null
        ]);
        metrics = computeVersionMetrics({ entries: activeEntries, rooms, parentEntries });
      }
      return { activeVersion: { ...activeVersion, entries: activeEntries, metrics }, versions: history };
    },

    /**
     * One version with its entries.
     */
    async getVersion(id) {
      const version = await versions.findById(id);
      if (!version) throw new NotFoundError('Version not found.');
      return { ...version, entries: await entries.findForEngine(id) };
    },

    /**
     * Make an earlier version the active one again.
     */
    async rollbackToVersion(id) {
      return withTransaction(prisma, async (tx) => {
        const versionRepo = createTimetableVersionRepository(tx);
        const target = await versionRepo.findById(id);
        if (!target) throw new NotFoundError(`Version with ID ${id} not found.`);
        return versionRepo.activate(id);
      });
    },

    /**
     * Reference data for the frontend forms and grids.
     */
    async getMetadata() {
      const [faculty, rooms, sections, subjects, timeSlots, blocks] = await Promise.all([
        academic.listFaculty(),
        academic.listRooms(),
        academic.listSections(),
        academic.listSubjects(),
        academic.listTimeSlots(),
        academic.listBlocks()
      ]);
      return { faculty, rooms, sections, subjects, timeSlots, blocks, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] };
    },

    /**
     * Names and ids the AI assistant may resolve in a sentence.
     */
    async getAiCatalog() {
      const [faculty, subjects] = await Promise.all([academic.listFaculty(), academic.listSubjects()]);
      return { faculty, subjects };
    },

    listApprovalHistory: () => disruptions.findApprovalLogs()
  };
}

/**
 * Notify affected students and faculty after an approval.
 * A notification failure is logged but never undoes the approval.
 *
 * @param {object} notificationService Notification service.
 * @param {object} alternative The approved alternative.
 * @param {object[]} originalEntries Entries before the change, used to find the combined sections.
 * @returns {Promise<object | null>} Notification summary, or null if nothing was sent.
 */
async function notifyAffectedUsers(notificationService, alternative, originalEntries) {
  const originals = new Map(originalEntries.map((entry) => [entry.id, entry]));
  const modifiedEntries = (alternative.modifiedEntries ?? []).map((change) => {
    const original = originals.get(change.entryId);
    return {
      ...change,
      sectionIds: original ? sectionsOf(original) : [change.sectionId],
      facultyIds: [...new Set([original?.facultyId, change.oldFacultyId, change.newFacultyId, change.facultyId].filter(Boolean))]
    };
  });
  if (modifiedEntries.length === 0) return null;

  try {
    return await notificationService.notifyRescheduleApproved({ modifiedEntries });
  } catch (error) {
    console.error('Failed to create reschedule notifications:', error);
    return null;
  }
}
