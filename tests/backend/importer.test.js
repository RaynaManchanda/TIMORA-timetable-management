import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { importCollegeTimetable } from '../../src/importer/import-service.js';
import { bearer, createTestContext } from './helpers/test-context.js';
import { WORKBOOK } from './helpers/workbook.js';

describe('Importing the college workbook into PostgreSQL', () => {
  let context;
  let first;

  beforeAll(async () => {
    context = await createTestContext({ env: { BCRYPT_COST: '4' } });
    first = await importCollegeTimetable({ prisma: context.prisma, filePath: WORKBOOK });
  });

  afterAll(() => context.close());

  test('stores sections, faculty, rooms, subjects, classes and reserved blocks', async () => {
    expect(first.skipped).toBe(false);
    expect(first.summary).toMatchObject({ sheets: 10, faculty: 88, rooms: 26, subjects: 27 });

    const count = (model, where = {}) => context.prisma[model].count({ where });
    expect(await count('section', { batch: 2024 })).toBe(10);
    expect(await count('timetableEntry', { versionId: first.versionId })).toBe(first.summary.classes);
    expect(await count('sectionBlock')).toBe(first.summary.blocks);
    expect(await count('timeSlot')).toBe(9);

    const active = await context.prisma.timetableVersion.findMany({ where: { status: 'ACTIVE' } });
    expect(active.map((v) => v.id)).toEqual([first.versionId]);
    expect(active[0].name).toBe('2024 Batch V wef 24th Aug 26. Ver III');
  });

  test('keeps the original sheet text of each class and an audit record of the import', async () => {
    const entry = await context.prisma.timetableEntry.findFirst({ where: { sectionId: '2024_CSE_V', day: 'MONDAY', slotId: 'S3' } });
    expect(entry.sourceCell).toBe('24-CSE V!D2: SE LAB NB209');

    const batch = await context.prisma.importBatch.findFirst({ where: { versionId: first.versionId } });
    expect(batch.sourceFile).toBe('2024 Batch V wef 24th Aug 26. Ver III.xlsx');
    expect(batch.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(batch.issues.filter((i) => i.severity === 'conflict')).toHaveLength(1);
  });

  test('importing the same file again changes nothing; --force adds a new version and archives the old one', async () => {
    const again = await importCollegeTimetable({ prisma: context.prisma, filePath: WORKBOOK });
    expect(again.skipped).toBe(true);
    expect(await context.prisma.timetableVersion.count({ where: { status: { not: 'DRAFT' } } })).toBe(2); // fixture version + first import

    const forced = await importCollegeTimetable({ prisma: context.prisma, filePath: WORKBOOK, force: true });
    expect(forced.skipped).toBe(false);
    expect(forced.versionNumber).not.toBe(first.versionNumber);

    const versions = await context.prisma.timetableVersion.findMany();
    expect(versions.filter((v) => v.status === 'ACTIVE').map((v) => v.id)).toEqual([forced.versionId]);
    expect(versions.find((v) => v.id === first.versionId).status).toBe('ARCHIVED');
    expect(await context.prisma.section.count({ where: { batch: 2024 } })).toBe(10); // upserted, not duplicated
    expect(await context.prisma.faculty.count({ where: { email: { endsWith: '@faculty.timora.invalid' } } })).toBe(88);
  });

  test('the imported timetable reaches students through the API, including combined and elective classes', async () => {
    const student = await context.createUser({ role: 'STUDENT', sectionId: '2024_CSE_V' });
    const outsider = await context.createUser({ role: 'STUDENT', sectionId: '2024_ME' });

    const mine = await context.http().get('/api/timetables').set(bearer(student.token));
    expect(mine.status).toBe(200);
    expect(mine.body.entries.length).toBe(41);
    const combined = mine.body.entries.find((e) => e.subjectId === 'SUB_CSE3105' && e.day === 'MONDAY' && e.slot === 'S7');
    expect(combined.coSectionIds).toEqual(['2024_CSE_VI']);

    // The sixth-section classmate sees the very same combined class.
    const classmate = await context.createUser({ role: 'STUDENT', sectionId: '2024_CSE_VI' });
    const theirs = await context.http().get('/api/timetables').query({ day: 'MONDAY' }).set(bearer(classmate.token));
    expect(theirs.body.entries.some((e) => e.id === combined.id)).toBe(true);

    const other = await context.http().get('/api/timetables').set(bearer(outsider.token));
    expect(other.body.entries.some((e) => e.id === combined.id)).toBe(false);
    expect((await context.http().get('/api/timetables').query({ section: '2024_CSE_V' }).set(bearer(outsider.token))).status).toBe(403);

    // The weekly lunch hours of the section are available for the grid.
    const blocks = await context.http().get('/api/academic/blocks').query({ section: '2024_CSE_V' }).set(bearer(student.token));
    expect(blocks.body.blocks.filter((b) => b.kind === 'LUNCH')).toHaveLength(5);
  });

  test('the database itself refuses a double booking in the imported timetable', async () => {
    const { versionId } = first;
    const existing = await context.prisma.timetableEntry.findFirst({ where: { versionId, roomId: 'R_NB314', sessionType: 'LECTURE' } });
    const when = { versionId, day: existing.day, slotId: existing.slotId };

    // A free teacher and a free section, so that only the room is double-booked.
    const freeTeacher = await context.prisma.faculty.findFirst({ where: { email: { endsWith: '@faculty.timora.invalid' }, entries: { none: when } } });
    const freeSection = await context.prisma.section.findFirst({ where: { batch: 2024, entries: { none: when } } });

    const clash = context.prisma.timetableEntry.create({
      data: { id: 'E_CLASH', ...when, sectionId: freeSection.id, subjectId: existing.subjectId, facultyId: freeTeacher.id, roomId: existing.roomId }
    });

    await expect(clash).rejects.toMatchObject({ code: 'P2002' });
    await expect(clash).rejects.toThrow(/room_id/);
  });
});
