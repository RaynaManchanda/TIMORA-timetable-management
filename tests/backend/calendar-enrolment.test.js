import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { buildCalendarEvents } from '../../src/calendar/calendar-event-builder.js';
import { bearer, createTestContext } from './helpers/test-context.js';

describe('Calendar holds only the classes the student is enrolled in', () => {
  let context;
  let student;
  let googleClient;
  const pushed = [];

  beforeAll(async () => {
    googleClient = {
      isConfigured: true,
      refreshAccessToken: jest.fn(),
      pushEvents: jest.fn(async (connection, events) => {
        pushed.push(events.map((e) => e.summary));
        return events.map((e) => `g_${e.id}`);
      }),
      deleteEvents: jest.fn(async () => {})
    };
    context = await createTestContext({ overrides: { googleClient }, withEntries: true, env: { BCRYPT_COST: '4' } });
    // Two parallel electives in one slot of the student's section (the student attends one of them).
    await context.prisma.timetableEntry.createMany({
      data: [
        { id: 'EL1', versionId: 'VER_1.0', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS502', facultyId: 'F104', roomId: 'R201', day: 'FRIDAY', slotId: 'S2', isElective: true },
        { id: 'EL2', versionId: 'VER_1.0', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_EC501', facultyId: 'F103', roomId: 'R204', day: 'FRIDAY', slotId: 'S2', isElective: true }
      ]
    });
    student = await context.createUser({ role: 'STUDENT', sectionId: 'SEC_CSE_5A' });
    await context.services.calendarService.saveConnection({
      userId: student.user.id, tokenExpiresAt: new Date(Date.now() + 3600_000), accessToken: 'a', refreshToken: 'r'
    });
  });

  afterAll(() => context.close());

  const events = () => context.http().get('/api/calendar/events').set(bearer(student.token));
  const sync = () => context.http().post('/api/calendar/sync').set(bearer(student.token)).send({});
  const choose = (subjectIds) => context.http().put('/api/calendar/electives').set(bearer(student.token)).send({ subjectIds });

  test('lists the electives of the own section only', async () => {
    const response = await context.http().get('/api/calendar/electives').set(bearer(student.token));

    expect(response.body.options.map((o) => o.subjectId)).toEqual(['SUB_CS502', 'SUB_EC501']);
    expect(response.body.selected).toEqual([]);
  });

  test('before choosing, parallel electives are NOT in the calendar, only the regular classes of the section', async () => {
    const response = await events();

    expect(response.body.count).toBe(7); // the 7 regular classes of SEC_CSE_5A
    expect(JSON.stringify(response.body.events)).not.toMatch(/EC501|Digital Signal/);
  });

  test('after enrolling in one elective, exactly that one is added', async () => {
    expect((await choose(['SUB_EC501'])).status).toBe(200);

    const response = await events();

    expect(response.body.count).toBe(8);
    expect(response.body.events.filter((e) => e.summary.startsWith('EC501')).length).toBe(1);
    expect(response.body.events.filter((e) => e.summary.startsWith('CS502') && e.start.dateTime.includes('T10:00')).length).toBe(0);
  });

  test('refuses an elective that is not offered to the section, and non-students', async () => {
    const outside = await choose(['SUB_MA501']);
    expect(outside.status).toBe(400);
    expect(outside.body.message).toBe('SUB_MA501 is not an elective of your section');

    const admin = await context.createUser({ role: 'COORDINATOR' });
    const asAdmin = await context.http().put('/api/calendar/electives').set(bearer(admin.token)).send({ subjectIds: [] });
    expect(asAdmin.status).toBe(400);
  });

  test('syncing again sends the same event ids (no duplicates) and removes events that no longer apply', async () => {
    const first = await sync();
    expect(first.status).toBe(200);
    expect(first.body.eventsCount).toBe(8);
    const sentFirst = googleClient.pushEvents.mock.calls.at(-1)[1].map((e) => e.id);
    expect(new Set(sentFirst).size).toBe(sentFirst.length);

    // Same timetable again: identical ids, nothing to delete.
    googleClient.deleteEvents.mockClear();
    await sync();
    expect(googleClient.pushEvents.mock.calls.at(-1)[1].map((e) => e.id)).toEqual(sentFirst);
    expect(googleClient.deleteEvents).not.toHaveBeenCalled();

    // Switch elective: the old elective event is deleted from Google, the new one is added.
    await choose(['SUB_CS502']);
    await sync();
    const [, deletedIds] = googleClient.deleteEvents.mock.calls.at(-1);
    expect(deletedIds).toHaveLength(1);
    const { rows } = await context.pool.query('SELECT synced_event_ids FROM google_calendar_connections WHERE user_id = $1', [student.user.id]);
    expect(rows[0].synced_event_ids).toHaveLength(8);
    expect(rows[0].synced_event_ids).not.toContain(deletedIds[0]);
  });
});

describe('buildCalendarEvents', () => {
  test('never holds the same class twice', () => {
    const entry = { id: 'E1', sectionId: 'S', subjectId: 'X', subjectCode: 'X1', subjectName: 'X', roomId: 'R', roomName: 'R', building: 'B', facultyId: 'F', facultyName: 'F', day: 'MONDAY', slot: 'S1' };

    const { count } = buildCalendarEvents([entry, { ...entry, id: 'E2' }], { timeZone: 'Asia/Kolkata', startDate: new Date('2026-11-01T00:00:00Z') });

    expect(count).toBe(1);
  });
});
