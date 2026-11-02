import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { bearer, createTestContext } from './helpers/test-context.js';
import { buildEntryBody, insertSection } from './helpers/timetable-fixtures.js';

const FIXED_NOW = new Date('2026-11-01T08:00:00.000Z');
const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MORNING_AND_AFTERNOON_SLOTS = ['S1', 'S2', 'S3', 'S5'];

describe('Google Calendar integration', () => {
  let context;
  let student;
  let googleClient;

  /** 24 weekly entries: four slots on each of six days, so no two collide. */
  const weeklyEntries = WEEKDAYS.flatMap((day) =>
    MORNING_AND_AFTERNOON_SLOTS.map((slot) =>
      buildEntryBody({ sectionId: 'CSE5', day, slot, roomId: slot === 'S2' ? 'R204' : 'R202' })
    )
  );

  const countEntries = async () =>
    (await context.pool.query('SELECT COUNT(*)::int AS total FROM timetable_entries')).rows[0].total;

  const getConnectionStatus = async (userId) =>
    (await context.pool.query('SELECT auth_status FROM google_calendar_connections WHERE user_id = $1', [userId])).rows[0]
      .auth_status;

  beforeAll(async () => {
    googleClient = { refreshAccessToken: jest.fn(), pushEvents: jest.fn() };
    context = await createTestContext({ overrides: { googleClient, clock: () => FIXED_NOW } });
    await insertSection(context.pool, 'CSE5');
    student = await context.createUser({ role: 'STUDENT', sectionId: 'CSE5' });

    await context.services.timetableService.saveVersion(
      { name: 'Calendar test timetable', entries: weeklyEntries },
      { name: 'Test Admin' }
    );
  });

  afterAll(() => context.close());

  test('TC16 - builds 24 recurring weekly events in the Asia/Kolkata time zone', async () => {
    const response = await context.http().get('/api/calendar/events').set(bearer(student.token));

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(24);
    expect(response.body.events).toHaveLength(24);
    for (const event of response.body.events) {
      expect(event.start.timeZone).toBe('Asia/Kolkata');
      expect(event.end.timeZone).toBe('Asia/Kolkata');
      expect(event.recurrence[0]).toMatch(/^RRULE:FREQ=WEEKLY;BYDAY=(MO|TU|WE|TH|FR|SA)$/);
    }
  });

  test('TC16 - an event carries the correct title, room, times and weekday', async () => {
    const response = await context.http().get('/api/calendar/events').set(bearer(student.token));

    const tuesdayS2 = response.body.events.find((event) => event.recurrence[0].endsWith('BYDAY=TU') && event.start.dateTime.endsWith('T10:00:00'));

    expect(tuesdayS2).toMatchObject({
      summary: 'CS501 - Database Management Systems',
      location: 'Room 302, Academic Block',
      start: { dateTime: '2026-11-03T10:00:00', timeZone: 'Asia/Kolkata' },
      end: { dateTime: '2026-11-03T10:55:00', timeZone: 'Asia/Kolkata' }
    });
  });

  test('a student only receives events for their own section', async () => {
    await insertSection(context.pool, 'CSE9');
    const outsider = await context.createUser({ role: 'STUDENT', sectionId: 'CSE9' });

    const response = await context.http().get('/api/calendar/events').set(bearer(outsider.token));

    expect(response.body.count).toBe(0);
  });

  test('TC17 - an expired, non-refreshable authorisation stops the sync and requires re-authorisation', async () => {
    await context.services.calendarService.saveConnection({
      userId: student.user.id,
      tokenExpiresAt: new Date('2026-10-01T00:00:00.000Z'),
      canRefreshToken: false
    });
    const entriesBefore = await countEntries();

    const response = await context.http().post('/api/calendar/sync').set(bearer(student.token));

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Google Calendar access has expired. Please reconnect your account.');
    expect(response.body.connectionStatus).toBe('REAUTH_REQUIRED');
    expect(await getConnectionStatus(student.user.id)).toBe('REAUTH_REQUIRED');
    expect(googleClient.pushEvents).not.toHaveBeenCalled();
    expect(await countEntries()).toBe(entriesBefore);
  });

  test('TC17 - a failed token refresh is treated the same way', async () => {
    const faculty = await context.createUser({ role: 'FACULTY', facultyId: 'F101' });
    await context.services.calendarService.saveConnection({
      userId: faculty.user.id,
      tokenExpiresAt: new Date('2026-10-01T00:00:00.000Z'),
      canRefreshToken: true
    });
    googleClient.refreshAccessToken.mockRejectedValueOnce(new Error('invalid_grant'));

    const response = await context.http().post('/api/calendar/sync').set(bearer(faculty.token));

    expect(response.status).toBe(401);
    expect(await getConnectionStatus(faculty.user.id)).toBe('REAUTH_REQUIRED');
  });

  test('syncs the events when the authorisation is valid', async () => {
    const synced = await context.createUser({ role: 'STUDENT', sectionId: 'CSE5' });
    await context.services.calendarService.saveConnection({
      userId: synced.user.id,
      tokenExpiresAt: new Date('2026-11-01T12:00:00.000Z'),
      canRefreshToken: true
    });

    const response = await context.http().post('/api/calendar/sync').set(bearer(synced.token));

    expect(response.status).toBe(200);
    expect(response.body.eventsCount).toBe(24);
    expect(googleClient.pushEvents).toHaveBeenCalledWith(expect.objectContaining({ userId: synced.user.id }), expect.any(Array));

    const status = await context.http().get('/api/calendar/status').set(bearer(synced.token));
    expect(status.body).toMatchObject({ connected: true, authStatus: 'ACTIVE', eventsCount: 24 });
  });

  test('refreshes an expired token that can be refreshed and then syncs', async () => {
    const refreshed = await context.createUser({ role: 'STUDENT', sectionId: 'CSE5' });
    await context.services.calendarService.saveConnection({
      userId: refreshed.user.id,
      tokenExpiresAt: new Date('2026-10-01T00:00:00.000Z'),
      canRefreshToken: true
    });
    googleClient.refreshAccessToken.mockResolvedValueOnce({});

    const response = await context.http().post('/api/calendar/sync').set(bearer(refreshed.token));

    expect(response.status).toBe(200);
  });

  test('asks the user to connect first when no Google account is linked', async () => {
    const unlinked = await context.createUser({ role: 'STUDENT', sectionId: 'CSE5' });

    const response = await context.http().post('/api/calendar/sync').set(bearer(unlinked.token));

    expect(response.status).toBe(409);
    expect(response.body.connectionStatus).toBe('DISCONNECTED');
  });
});
