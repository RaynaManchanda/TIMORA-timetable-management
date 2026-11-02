/**
 * TIMORA - Timetable generation service
 *
 * Re-plans the weekly timetable of one or all sections from the teaching load of the active
 * timetable (which subjects, taught by whom, how many hours a week), while:
 *   - keeping every other section's classes where they are,
 *   - respecting each section's lunch, mentoring and minor-programme time,
 *   - never double-booking a room or a teacher.
 *
 * The result is stored as a DRAFT version. Nothing changes for students and faculty until an
 * administrator publishes the draft.
 */

import { withTransaction } from '../db/transaction.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/app-errors.js';
import { generateId } from '../utils/id-generator.js';
import { createAcademicRepository } from '../repositories/academic-repository.js';
import { createTimetableEntryRepository } from '../repositories/timetable-entry-repository.js';
import { createTimetableVersionRepository } from '../repositories/timetable-version-repository.js';
import { fromEngineEntry } from '../repositories/entry-mappers.js';
import { schedulingEngine } from './scheduling-engine.js';

/**
 * Create the generation service.
 *
 * @param {{ prisma: import('@prisma/client').PrismaClient }} dependencies Collaborators.
 */
export function createGenerationService({ prisma }) {
  const versions = createTimetableVersionRepository(prisma);
  const entries = createTimetableEntryRepository(prisma);
  const academic = createAcademicRepository(prisma);

  /**
   * The weekly teaching load of a section as engine "subjects".
   * Combined and elective classes are shared with other sections, so they stay as they are.
   *
   * @param {string} sectionId Section id.
   * @param {object[]} activeEntries Active timetable (engine shape).
   * @param {Map<string, object>} subjectsById Subjects.
   * @returns {{ subjects: object[], hoursBySubjectKey: Map<string, string> }}
   */
  function buildLoad(sectionId, activeEntries, subjectsById) {
    const groups = new Map();
    for (const entry of activeEntries) {
      if (entry.sectionId !== sectionId || entry.isElective || entry.coSectionIds.length > 0) continue;
      const key = `${entry.subjectId}::${entry.sessionType}::${entry.facultyId}`;
      const group = groups.get(key) ?? { entry, hours: 0 };
      group.hours += 1;
      groups.set(key, group);
    }

    const sessionTypes = new Map();
    const subjects = [...groups.entries()].map(([key, { entry, hours }]) => {
      const subject = subjectsById.get(entry.subjectId);
      sessionTypes.set(key, entry.sessionType);
      return {
        id: key,
        code: subject?.code ?? entry.subjectId,
        name: subject?.name ?? entry.subjectId,
        type: entry.sessionType === 'LAB' ? 'LAB' : 'LECTURE',
        facultyId: entry.facultyId,
        requiredHoursPerWeek: hours,
        breakdown: entry.sessionType === 'LAB' ? { labs: hours } : { lectures: hours },
        realSubjectId: entry.subjectId
      };
    });
    return { subjects, sessionTypes };
  }

  return {
    /**
     * Generate a draft timetable.
     *
     * @param {{ sectionId?: string, maxGapHours?: number, mandatoryBreak?: boolean|string }} body Request body.
     * @param {{ name: string }} creator Administrator generating the draft.
     * @returns {Promise<object>} Draft summary and the generated entries.
     */
    async generateDraft(body, creator) {
      const { sectionId, maxGapHours, mandatoryBreak } = body ?? {};
      const active = await versions.findActive();
      if (!active) throw new ConflictError('There is no active timetable version to plan from.');

      const [allSections, rooms, faculty, subjects, timeSlots, blocks, activeEntries] = await Promise.all([
        academic.listSections(),
        academic.listRooms(),
        academic.listFaculty(),
        academic.listSubjects(),
        academic.listTimeSlots(),
        academic.listBlocks(),
        entries.findForEngine(active.id)
      ]);

      const sections = sectionId ? allSections.filter((section) => section.id === sectionId) : allSections;
      if (sectionId && sections.length === 0) throw new NotFoundError(`Section ${sectionId} not found.`);

      const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
      const targetIds = new Set(sections.map((section) => section.id));

      // Everything that is not re-planned stays where it is and constrains the new classes.
      const keptEntries = activeEntries.filter(
        (entry) => !(targetIds.has(entry.sectionId) && !entry.isElective && entry.coSectionIds.length === 0)
      );

      const generated = [];
      let metrics = null;
      for (const section of sections) {
        const { subjects: load, sessionTypes } = buildLoad(section.id, activeEntries, subjectsById);
        if (load.length === 0) continue;

        const result = schedulingEngine.generateTimetable({
          subjects: load,
          faculty,
          rooms,
          sections: [section],
          timeSlots,
          blocks,
          fixedEntries: [...keptEntries, ...generated],
          options: { maxGapHours, mandatoryBreak }
        });

        if (result.status === 'INFEASIBLE') {
          const error = new ValidationError(`${section.name}: ${result.error}`);
          error.details = { ...error.details, status: 'INFEASIBLE', conflicts: result.conflicts };
          throw error;
        }

        const loadByEngineId = new Map(load.map((item) => [item.id, item]));
        for (const entry of result.entries) {
          const source = loadByEngineId.get(entry.subjectId);
          generated.push({
            ...entry,
            subjectId: source.realSubjectId,
            sessionType: sessionTypes.get(entry.subjectId) ?? entry.sessionType
          });
        }
        metrics = result.metrics;
      }

      if (generated.length === 0) {
        throw new ValidationError('The selected sections have no regular classes to plan.');
      }

      const finalEntries = [...keptEntries, ...generated];
      const draft = await withTransaction(prisma, async (tx) => {
        const created = await tx.timetableVersion.create({
          data: {
            id: generateId('VER'),
            versionNumber: 'draft',
            name: `Draft: ${sectionId ? sections[0].name : 'all sections'} re-planned`,
            status: 'DRAFT',
            parentVersionId: active.id,
            approvedBy: creator.name,
            changeLog: `Generated draft for ${sections.length} section(s), ${generated.length} classes.`
          }
        });
        await createTimetableEntryRepository(tx).insertMany(
          finalEntries.map((entry) => fromEngineEntry(entry, created.id, () => generateId('E')))
        );
        return created;
      });

      return {
        draftVersionId: draft.id,
        status: 'OPTIMAL',
        qualityScore: metrics?.qualityScore ?? 0,
        metrics,
        entriesCount: generated.length,
        entries: generated
      };
    },

    /**
     * Publish a draft: it becomes the active version and the previous one is archived.
     *
     * @param {string} draftId Draft version id.
     * @param {{ name: string }} approver Administrator publishing it.
     * @returns {Promise<object>} The published version.
     */
    async publishDraft(draftId, approver) {
      return withTransaction(prisma, async (tx) => {
        const repo = createTimetableVersionRepository(tx);
        const draft = await repo.findById(draftId);
        if (!draft) throw new NotFoundError('Draft not found.');
        if (draft.status !== 'DRAFT') throw new ConflictError('Only a draft can be published.');

        const versionCount = await tx.timetableVersion.count({ where: { status: { not: 'DRAFT' } } });
        await repo.archiveActive();
        const published = await tx.timetableVersion.update({
          where: { id: draftId },
          data: { status: 'ACTIVE', versionNumber: `v1.${versionCount}`, approvedBy: approver.name }
        });
        return { id: published.id, versionNumber: published.versionNumber, name: published.name, status: published.status };
      });
    },

    /**
     * Throw a draft away.
     *
     * @param {string} draftId Draft version id.
     * @returns {Promise<void>}
     */
    async discardDraft(draftId) {
      const { count } = await prisma.timetableVersion.deleteMany({ where: { id: draftId, status: 'DRAFT' } });
      if (count === 0) throw new NotFoundError('Draft not found.');
    }
  };
}
