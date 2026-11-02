import { RRULE_WEEKDAY_CODES, TIME_SLOTS } from '../constants/academic.js';
import { nextDateForWeekday } from '../utils/date-utils.js';

/**
 * Find the start and end time of a slot.
 *
 * @param {string} slotId Slot id such as "S2".
 * @returns {{ startTime: string, endTime: string }}
 */
function findSlotTimes(slotId) {
  const slot = TIME_SLOTS.find((candidate) => candidate.id === slotId);
  if (!slot) {
    throw new Error(`Unknown time slot: ${slotId}`);
  }
  return { startTime: slot.startTime, endTime: slot.endTime };
}

/**
 * Convert one timetable entry into a weekly recurring Google Calendar event.
 *
 * @param {object} entry Detailed timetable entry.
 * @param {{ timeZone: string, startDate: Date }} options Time zone and the date from which to schedule.
 * @returns {object} Google Calendar event resource.
 */
function toCalendarEvent(entry, { timeZone, startDate }) {
  const { startTime, endTime } = findSlotTimes(entry.slot);
  const date = nextDateForWeekday(entry.day, startDate);

  return {
    id: `cal_${entry.id}`,
    summary: `${entry.subjectCode} - ${entry.subjectName}`,
    location: `${entry.roomName}, ${entry.building}`,
    description: `Section: ${entry.sectionId} | Faculty: ${entry.facultyName}`,
    start: { dateTime: `${date}T${startTime}:00`, timeZone },
    end: { dateTime: `${date}T${endTime}:00`, timeZone },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${RRULE_WEEKDAY_CODES[entry.day]}`],
    sourceTimetableEntryId: entry.id
  };
}

/**
 * Convert timetable entries into recurring weekly calendar events.
 *
 * @param {object[]} entries Detailed timetable entries.
 * @param {{ timeZone: string, startDate?: Date }} options Time zone and first date to schedule from.
 * @returns {{ count: number, timeZone: string, events: object[] }}
 */
export function buildCalendarEvents(entries, { timeZone, startDate = new Date() }) {
  // The same class can reach the list twice (e.g. a combined class); a calendar must hold it once.
  const seen = new Set();
  const unique = entries.filter((entry) => {
    const key = [entry.subjectId, entry.day, entry.slot, entry.roomId, entry.facultyId].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const events = unique.map((entry) => toCalendarEvent(entry, { timeZone, startDate }));
  return { count: events.length, timeZone, events };
}
