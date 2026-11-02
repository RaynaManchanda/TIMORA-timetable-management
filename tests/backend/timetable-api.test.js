import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { bearer, createTestContext } from './helpers/test-context.js';
import { buildEntryBody, insertSection } from './helpers/timetable-fixtures.js';

describe('Timetable REST API', () => {
  let context;
  let admin;
  let student;

  beforeAll(async () => {
    context = await createTestContext();
    await insertSection(context.pool, 'CSE5');
    await insertSection(context.pool, 'CSE6');
    admin = await context.createUser({ role: 'COORDINATOR' });
    student = await context.createUser({ role: 'STUDENT', sectionId: 'CSE5' });
  });

  afterAll(() => context.close());

  /**
   * Create a timetable entry as the administrator.
   *
   * @param {object} body Entry request body.
   * @returns {Promise<import('supertest').Response>}
   */
  const createEntry = (body) => context.http().post('/api/timetables').set(bearer(admin.token)).send(body);

  const countEntries = async () =>
    (await context.pool.query('SELECT COUNT(*)::int AS total FROM timetable_entries')).rows[0].total;

  test('TC09 - an administrator creates a timetable entry and it is stored with every submitted field', async () => {
    const body = buildEntryBody();

    const response = await createEntry(body);

    expect(response.status).toBe(201);
    expect(response.body.entry).toMatchObject({ id: expect.any(String), ...body });

    const { rows } = await context.pool.query('SELECT * FROM timetable_entries WHERE id = $1', [response.body.entry.id]);
    expect(rows[0]).toMatchObject({
      section_id: 'CSE5',
      subject_id: 'SUB_CS501',
      faculty_id: 'F101',
      room_id: 'R204',
      day_of_week: 'TUESDAY',
      slot_id: 'S2'
    });
  });

  test('TC10 - rejects an entry without facultyId and slot, listing every missing field', async () => {
    const before = await countEntries();
    const { facultyId, slot, ...incompleteBody } = buildEntryBody();

    const response = await createEntry(incompleteBody);

    expect(response.status).toBe(400);
    expect(response.body.validationErrors).toEqual(['facultyId is required', 'slot is required']);
    expect(await countEntries()).toBe(before);
  });

  test('TC10 - rejects an unknown day and slot', async () => {
    const response = await createEntry(buildEntryBody({ day: 'FUNDAY', slot: 'S99' }));

    expect(response.status).toBe(400);
    expect(response.body.validationErrors).toHaveLength(2);
  });

  test('rejects references to a room that does not exist', async () => {
    const response = await createEntry(buildEntryBody({ roomId: 'R999', day: 'FRIDAY' }));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Unknown room: R999');
  });

  test('only administrators may create entries', async () => {
    const response = await context.http().post('/api/timetables').set(bearer(student.token)).send(buildEntryBody());

    expect(response.status).toBe(403);
  });

  test('TC11 - returns only the section and day requested, ordered from S1 to S6', async () => {
    // TC09 already stored CSE5 / TUESDAY / S2, so five more entries complete S1 to S6 (inserted out of order).
    const tuesdayCse5Slots = ['S6', 'S3', 'S1', 'S5', 'S4'];
    for (const [index, slot] of tuesdayCse5Slots.entries()) {
      await createEntry(buildEntryBody({ sectionId: 'CSE5', day: 'TUESDAY', slot, roomId: 'R201', facultyId: 'F10' + (index % 4 + 1) }));
    }
    await createEntry(buildEntryBody({ sectionId: 'CSE5', day: 'WEDNESDAY', slot: 'S1', roomId: 'R203' }));
    await createEntry(buildEntryBody({ sectionId: 'CSE6', day: 'TUESDAY', slot: 'S7', roomId: 'R203' }));

    const response = await context
      .http()
      .get('/api/timetables')
      .query({ section: 'CSE5', day: 'TUESDAY' })
      .set(bearer(student.token));

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(response.body.entries.length);
    expect(response.body.entries.every((entry) => entry.sectionId === 'CSE5' && entry.day === 'TUESDAY')).toBe(true);
    const slots = response.body.entries.map((entry) => entry.slot);
    expect(slots).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  });

  test("a student cannot read another section's timetable", async () => {
    const response = await context
      .http()
      .get('/api/timetables')
      .query({ section: 'CSE6' })
      .set(bearer(student.token));

    expect(response.status).toBe(403);
  });

  test('a student without a section query only receives their own section', async () => {
    const response = await context.http().get('/api/timetables').set(bearer(student.token));

    expect(response.status).toBe(200);
    expect(response.body.entries.every((entry) => entry.sectionId === 'CSE5')).toBe(true);
  });

  test('TC12 - rejects room double booking with 409 and a clear message', async () => {
    await createEntry(buildEntryBody({ sectionId: 'CSE5', roomId: 'R202', facultyId: 'F101', day: 'SATURDAY', slot: 'S2' }));
    const before = await countEntries();

    const response = await createEntry(
      buildEntryBody({ sectionId: 'CSE6', roomId: 'R202', facultyId: 'F102', day: 'SATURDAY', slot: 'S2' })
    );

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Room R202 is already booked for SATURDAY slot S2.');
    expect(await countEntries()).toBe(before);
  });

  test('TC12 - the database unique constraint itself rejects a duplicate room, day and slot', async () => {
    const { rows } = await context.pool.query('SELECT * FROM timetable_entries WHERE room_id = $1 AND day_of_week = $2', [
      'R202',
      'SATURDAY'
    ]);
    const existing = rows[0];

    const duplicateInsert = context.pool.query(
      `INSERT INTO timetable_entries (id, version_id, section_id, subject_id, faculty_id, room_id, day_of_week, slot_id)
       VALUES ('E_RAW', $1, 'CSE6', 'SUB_CS501', 'F103', $2, $3, $4)`,
      [existing.version_id, existing.room_id, existing.day_of_week, existing.slot_id]
    );

    await expect(duplicateInsert).rejects.toMatchObject({ code: '23505', constraint: 'uq_room_day_slot_version' });
  });

  test('rejects faculty double booking with 409', async () => {
    await createEntry(buildEntryBody({ sectionId: 'CSE5', roomId: 'R201', facultyId: 'F104', day: 'MONDAY', slot: 'S3' }));

    const response = await createEntry(
      buildEntryBody({ sectionId: 'CSE6', roomId: 'R203', facultyId: 'F104', day: 'MONDAY', slot: 'S3' })
    );

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Faculty F104 is already booked for MONDAY slot S3.');
  });

  test('rejects a section that already has a class in the slot with 409', async () => {
    await createEntry(buildEntryBody({ sectionId: 'CSE6', roomId: 'R201', facultyId: 'F101', day: 'MONDAY', slot: 'S5' }));

    const response = await createEntry(
      buildEntryBody({ sectionId: 'CSE6', roomId: 'R203', facultyId: 'F102', day: 'MONDAY', slot: 'S5' })
    );

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Section CSE6 already has a class on MONDAY slot S5.');
  });
});
