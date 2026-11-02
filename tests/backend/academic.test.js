import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { bearer, createTestContext } from './helpers/test-context.js';

describe('Academic data (rooms, faculty, subjects, sections)', () => {
  let context;
  let admin;
  let student;

  beforeAll(async () => {
    context = await createTestContext({ withEntries: true, env: { BCRYPT_COST: '4' } });
    admin = await context.createUser({ role: 'COORDINATOR' });
    student = await context.createUser({ role: 'STUDENT', sectionId: 'SEC_CSE_5A' });
  });

  afterAll(() => context.close());

  const as = (user, method, url, body) => context.http()[method](url).set(bearer(user.token)).send(body);

  test('any signed-in user can read the lists, but staff contact details stay with administrators', async () => {
    const asStudent = await as(student, 'get', '/api/academic/faculty');
    expect(asStudent.status).toBe(200);
    expect(asStudent.body.faculty.length).toBeGreaterThan(0);
    expect(asStudent.body.faculty.every((person) => !('email' in person))).toBe(true);

    const asAdmin = await as(admin, 'get', '/api/academic/faculty');
    expect(asAdmin.body.faculty[0].email).toEqual(expect.any(String));

    const slots = await as(student, 'get', '/api/academic/time-slots');
    expect(slots.body.timeSlots).toHaveLength(9);
    expect(slots.body.timeSlots[0]).toMatchObject({ id: 'S1', startTime: '09:00', endTime: '09:55' });
  });

  test('only administrators can add or remove records', async () => {
    expect((await as(student, 'post', '/api/academic/rooms', { name: 'Hall Z', capacity: 50 })).status).toBe(403);
    expect((await as(student, 'delete', '/api/academic/rooms/R201')).status).toBe(403);
    expect((await context.http().post('/api/academic/rooms').send({ name: 'Hall Z', capacity: 50 })).status).toBe(401);
  });

  test('an administrator adds a room that is stored in PostgreSQL; bad input and duplicates are refused', async () => {
    const created = await as(admin, 'post', '/api/academic/rooms', { name: 'Seminar Hall B', building: 'Tech Block', capacity: 120, type: 'SEMINAR_HALL' });

    expect(created.status).toBe(201);
    expect(created.body.room).toMatchObject({ id: 'R_SEMINAR_HALL_B', name: 'Seminar Hall B', capacity: 120, type: 'SEMINAR_HALL' });
    expect(await context.prisma.room.findUnique({ where: { id: 'R_SEMINAR_HALL_B' } })).not.toBeNull();

    const duplicate = await as(admin, 'post', '/api/academic/rooms', { name: 'Seminar Hall B', capacity: 120 });
    expect(duplicate.status).toBe(409);

    const invalid = await as(admin, 'post', '/api/academic/rooms', { name: '', capacity: -5, type: 'CASTLE' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.validationErrors).toEqual(expect.arrayContaining(['name is required', 'capacity must be a whole number between 1 and 1000']));

    expect((await as(admin, 'post', '/api/academic/faculty', { name: 'Dr. No Email' })).status).toBe(400);
    expect((await as(admin, 'post', '/api/academic/sections', { name: 'CSE 9', studentCount: 40, semester: 4 })).status).toBe(201);
  });

  test('a record that classes still depend on cannot be deleted; an unused one can', async () => {
    const inUse = await as(admin, 'delete', '/api/academic/rooms/R202');
    expect(inUse.status).toBe(409);
    expect(inUse.body.message).toBe('This record is still used by timetable entries and cannot be deleted.');
    expect(await context.prisma.room.findUnique({ where: { id: 'R202' } })).not.toBeNull();

    const removed = await as(admin, 'delete', '/api/academic/rooms/R_SEMINAR_HALL_B');
    expect(removed.status).toBe(200);
    expect((await as(admin, 'delete', '/api/academic/rooms/R_SEMINAR_HALL_B')).status).toBe(404);
    expect((await as(admin, 'delete', '/api/academic/rooms/bad id!')).status).toBe(400);
  });
});
