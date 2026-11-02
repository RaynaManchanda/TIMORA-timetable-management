import path from 'node:path';
import { withTransaction } from '../db/transaction.js';
import { generateId } from '../utils/id-generator.js';
import { readWorkbook } from './workbook-reader.js';
import { parseCollegeWorkbook, slug } from './college-sheet-parser.js';

/** The workbook does not state class sizes; sections start with this placeholder until edited. */
const PLACEHOLDER_STUDENT_COUNT = 60;

/**
 * Load a college timetable workbook into the database as a new ACTIVE timetable version.
 *
 * Reference data (sections, faculty, rooms, subjects, time slots) is upserted, so running the
 * importer again with a revised workbook ("Ver IV") adds a new version and keeps the old ones.
 * Importing the very same file twice is a no-op unless `force` is set.
 *
 * @param {{ prisma: import('@prisma/client').PrismaClient, filePath: string, force?: boolean, approvedBy?: string, log?: (message: string) => void }} options Import options.
 * @returns {Promise<{ skipped: boolean, reason?: string, versionId?: string, summary?: object, issues?: object[] }>}
 */
export async function importCollegeTimetable({ prisma, filePath, force = false, approvedBy = 'Timetable import', log = () => {} }) {
  const { sheets, sha256 } = await readWorkbook(filePath);

  if (!force) {
    const already = await prisma.importBatch.findFirst({ where: { sourceHash: sha256 }, orderBy: { importedAt: 'desc' } });
    if (already) {
      return {
        skipped: true,
        reason: `This file was already imported on ${already.importedAt.toISOString()}.`,
        versionId: already.versionId
      };
    }
  }

  const parsed = parseCollegeWorkbook(sheets);
  if (parsed.classes.length === 0) {
    throw new Error('No classes could be read from the workbook; nothing was imported.');
  }
  log(`Parsed ${parsed.classes.length} classes for ${parsed.sections.length} sections (${parsed.issues.length} issues).`);

  const sourceFile = path.basename(filePath);
  const result = await withTransaction(prisma, (tx) => persist(tx, parsed, { sourceFile, sha256, approvedBy }));

  return { skipped: false, ...result };
}

/**
 * Write the parsed workbook inside an open transaction.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx Transaction client.
 * @param {object} parsed Result of parseCollegeWorkbook.
 * @param {{ sourceFile: string, sha256: string, approvedBy: string }} source Where the data came from.
 * @returns {Promise<{ versionId: string, versionNumber: string, summary: object, issues: object[] }>}
 */
async function persist(tx, parsed, { sourceFile, sha256, approvedBy }) {
  await tx.timeSlot.createMany({ data: parsed.timeSlots, skipDuplicates: true });

  for (const section of parsed.sections) {
    const fields = { name: section.name, program: section.program, semester: section.semester, batch: section.batch };
    await tx.section.upsert({
      where: { id: section.id },
      create: { id: section.id, ...fields, studentCount: PLACEHOLDER_STUDENT_COUNT },
      update: fields
    });
  }

  for (const faculty of parsed.faculty) {
    await tx.faculty.upsert({
      where: { id: faculty.id },
      create: faculty,
      update: { name: faculty.name, department: faculty.department }
    });
  }

  for (const room of parsed.rooms) {
    await tx.room.upsert({
      where: { id: room.id },
      create: room,
      update: { name: room.name, building: room.building, type: room.type, isShared: room.isShared }
    });
  }

  for (const subject of parsed.subjects) {
    const { key, ...fields } = subject;
    await tx.subject.upsert({
      where: { id: subject.id },
      create: fields,
      update: {
        name: fields.name,
        abbreviation: fields.abbreviation,
        category: fields.category,
        ldp: fields.ldp,
        department: fields.department
      }
    });
  }

  // A new version becomes the active one; the previous one is archived, never deleted.
  const previous = await tx.timetableVersion.findFirst({ where: { status: 'ACTIVE' } });
  const versionCount = await tx.timetableVersion.count();
  await tx.timetableVersion.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'ARCHIVED' } });

  const version = await tx.timetableVersion.create({
    data: {
      id: generateId('VER'),
      versionNumber: `v1.${versionCount}`,
      name: sourceFile.replace(/\.xlsx$/i, ''),
      status: 'ACTIVE',
      parentVersionId: previous?.id ?? null,
      approvedBy,
      changeLog: `Imported from "${sourceFile}": ${parsed.classes.length} classes, ${parsed.blocks.length} reserved blocks.`
    }
  });

  const subjectIdByKey = new Map(parsed.subjects.map((subject) => [subject.key, subject.id]));
  const roomIdByName = new Map(parsed.rooms.map((room) => [room.name, room.id]));

  await tx.timetableEntry.createMany({
    data: parsed.classes.map((item) => ({
      id: generateId('E'),
      versionId: version.id,
      sectionId: item.sectionId,
      coSectionIds: item.coSectionIds,
      subjectId: subjectIdByKey.get(item.subjectKey),
      facultyId: item.facultyId,
      roomId: roomIdByName.get(item.roomName),
      day: item.day,
      slotId: item.slotId,
      sessionType: item.sessionType,
      isElective: item.isElective,
      sourceCell: item.sourceCell
    }))
  });

  await tx.sectionBlock.createMany({
    data: parsed.blocks.map((block) => ({
      id: `BLK_${slug(block.sectionId)}_${block.day.slice(0, 3)}_${block.slotId}_${block.kind}`,
      sectionId: block.sectionId,
      day: block.day,
      slotId: block.slotId,
      kind: block.kind,
      label: block.label.slice(0, 255)
    })),
    skipDuplicates: true
  });

  const summary = {
    ...parsed.stats,
    faculty: parsed.faculty.length,
    rooms: parsed.rooms.length,
    subjects: parsed.subjects.length
  };

  await tx.importBatch.create({
    data: {
      id: generateId('IMP'),
      sourceFile,
      sourceHash: sha256,
      versionId: version.id,
      summary,
      issues: parsed.issues
    }
  });

  return { versionId: version.id, versionNumber: version.versionNumber, summary, issues: parsed.issues };
}
