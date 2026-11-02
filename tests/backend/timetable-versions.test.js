import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { bearer, createTestContext } from './helpers/test-context.js';
import { buildConflictFreeEntries, buildEntryBody, insertSection } from './helpers/timetable-fixtures.js';

describe('Timetable versions: atomic saves', () => {
  let context;
  let admin;

  beforeAll(async () => {
    context = await createTestContext();
    await insertSection(context.pool, 'CSE5');
    admin = await context.createUser({ role: 'ADMIN' });
  });

  afterAll(() => context.close());

  const saveVersion = (body) => context.http().post('/api/timetables/versions').set(bearer(admin.token)).send(body);

  const readVersions = async () => (await context.pool.query('SELECT id, status FROM timetable_versions ORDER BY created_at')).rows;

  const countEntries = async () =>
    (await context.pool.query('SELECT COUNT(*)::int AS total FROM timetable_entries')).rows[0].total;

  test('saves a version with its entries, archives the old one and keeps exactly one ACTIVE version', async () => {
    const response = await saveVersion({ name: 'Semester plan', entries: buildConflictFreeEntries(5) });

    expect(response.status).toBe(201);
    expect(response.body.entriesCount).toBe(5);
    expect(response.body.version).toMatchObject({ status: 'ACTIVE', parentVersionId: 'VER_1.0' });

    const versions = await readVersions();
    expect(versions.filter((version) => version.status === 'ACTIVE')).toHaveLength(1);
    expect(versions.find((version) => version.id === 'VER_1.0').status).toBe('ARCHIVED');
  });

  test('TC13 - rolls back the whole save when one of 40 entries violates a constraint', async () => {
    const versionsBefore = await readVersions();
    const activeBefore = versionsBefore.find((version) => version.status === 'ACTIVE');
    const entriesBefore = await countEntries();

    const entries = buildConflictFreeEntries(40);
    // Entry 25 reuses the room, day and slot of entry 10, so it fails midway through the save.
    entries[24] = buildEntryBody({ ...entries[9], sectionId: 'CSE5', facultyId: 'F102', subjectId: 'SUB_CS503' });

    const response = await saveVersion({ name: 'Broken plan', entries });

    expect(response.status).toBe(409);
    expect(await readVersions()).toEqual(versionsBefore);
    expect(await countEntries()).toBe(entriesBefore);

    const { rows } = await context.pool.query("SELECT id FROM timetable_versions WHERE status = 'ACTIVE'");
    expect(rows).toEqual([{ id: activeBefore.id }]);
  });

  test('rejects an invalid entry before opening a transaction and names its position', async () => {
    const entries = buildConflictFreeEntries(3);
    delete entries[1].facultyId;

    const response = await saveVersion({ name: 'Incomplete plan', entries });

    expect(response.status).toBe(400);
    expect(response.body.validationErrors).toEqual(['entries[1].facultyId is required']);
  });

  test('requires a name and at least one entry', async () => {
    const response = await saveVersion({ entries: [] });

    expect(response.status).toBe(400);
    expect(response.body.validationErrors).toEqual(['name is required', 'entries must be a non-empty array']);
  });

  test('lists versions newest first for any authenticated user', async () => {
    const student = await context.createUser({ role: 'STUDENT', sectionId: 'CSE5' });

    const response = await context.http().get('/api/timetables/versions').set(bearer(student.token));

    expect(response.status).toBe(200);
    expect(response.body.versions[0].name).toBe('Semester plan');
  });
});
