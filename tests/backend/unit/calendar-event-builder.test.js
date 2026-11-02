import { describe, expect, test } from '@jest/globals';
import { buildCalendarEvents } from '../../../src/calendar/calendar-event-builder.js';
import { nextDateForWeekday } from '../../../src/utils/date-utils.js';

describe('nextDateForWeekday', () => {
  const sunday = new Date('2026-11-01T22:30:00.000Z');

  test.each([
    ['SUNDAY', '2026-11-01'],
    ['MONDAY', '2026-11-02'],
    ['TUESDAY', '2026-11-03'],
    ['SATURDAY', '2026-11-07']
  ])('finds the first %s on or after Sunday 1 Nov 2026', (day, expected) => {
    expect(nextDateForWeekday(day, sunday)).toBe(expected);
  });
});

describe('buildCalendarEvents', () => {
  const entry = {
    id: 'E1',
    sectionId: 'CSE5',
    day: 'FRIDAY',
    slot: 'S5',
    subjectCode: 'CS503',
    subjectName: 'Operating Systems',
    roomName: 'Hall A',
    building: 'Tech Block',
    facultyName: 'Prof. Grace Hopper'
  };

  test('maps an entry to a weekly event using the slot times', () => {
    const { events } = buildCalendarEvents([entry], { timeZone: 'Asia/Kolkata', startDate: new Date('2026-11-01T00:00:00Z') });

    expect(events[0]).toMatchObject({
      id: 'cal_E1',
      summary: 'CS503 - Operating Systems',
      location: 'Hall A, Tech Block',
      start: { dateTime: '2026-11-06T13:00:00', timeZone: 'Asia/Kolkata' },
      end: { dateTime: '2026-11-06T13:55:00', timeZone: 'Asia/Kolkata' },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=FR']
    });
  });

  test('returns an empty result for an empty timetable', () => {
    expect(buildCalendarEvents([], { timeZone: 'Asia/Kolkata' })).toEqual({ count: 0, timeZone: 'Asia/Kolkata', events: [] });
  });

  test('fails loudly for a slot that does not exist', () => {
    expect(() => buildCalendarEvents([{ ...entry, slot: 'S99' }], { timeZone: 'Asia/Kolkata' })).toThrow('Unknown time slot: S99');
  });
});
