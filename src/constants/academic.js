/** Teaching days, stored upper-case in the database. */
export const DAYS = Object.freeze(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']);

/** Day names in the display form used by the scheduling modules ("Monday"). */
export const DAYS_OF_WEEK = Object.freeze(DAYS.map((day) => day.charAt(0) + day.slice(1).toLowerCase()));

/** The days on which the college holds classes; rescheduling only moves classes within them. */
export const TEACHING_DAYS = Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

/**
 * The teaching hours of the college timetable (columns B-J of every section sheet).
 * Classes run 55 minutes from the top of the hour. Lunch is not a fixed slot: each section
 * has its own lunch hour per day, stored as a SectionBlock.
 */
export const TIME_SLOTS = Object.freeze(
  [
    ['09:00', '09:55'],
    ['10:00', '10:55'],
    ['11:00', '11:55'],
    ['12:00', '12:55'],
    ['13:00', '13:55'],
    ['14:00', '14:55'],
    ['15:00', '15:55'],
    ['16:00', '16:55'],
    ['17:00', '17:55']
  ].map(([startTime, endTime], index) =>
    Object.freeze({
      id: `S${index + 1}`,
      slotNumber: index + 1,
      startTime,
      endTime,
      label: `${startTime} - ${endTime}`,
      isLunchBreak: false
    })
  )
);

/** Valid slot identifiers, e.g. S1 to S9. */
export const SLOT_IDS = Object.freeze(TIME_SLOTS.map((slot) => slot.id));

/** Allowed shape of a section identifier used in query strings and bodies. */
export const SECTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/** Two-letter RFC 5545 weekday codes used for calendar recurrence rules. */
export const RRULE_WEEKDAY_CODES = Object.freeze({
  MONDAY: 'MO',
  TUESDAY: 'TU',
  WEDNESDAY: 'WE',
  THURSDAY: 'TH',
  FRIDAY: 'FR',
  SATURDAY: 'SA'
});
