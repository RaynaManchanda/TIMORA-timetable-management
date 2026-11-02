const WEEKDAY_INDEX = Object.freeze({
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
});

/**
 * Find the first calendar date, on or after a start date, that falls on a weekday.
 * Works in UTC so the result does not depend on the server time zone.
 *
 * @param {string} dayName Upper-case weekday name, e.g. "TUESDAY".
 * @param {Date} fromDate Date to start searching from.
 * @returns {string} Date formatted as YYYY-MM-DD.
 */
export function nextDateForWeekday(dayName, fromDate) {
  const targetIndex = WEEKDAY_INDEX[dayName];
  const start = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  const daysToAdd = (targetIndex - start.getUTCDay() + 7) % 7;
  start.setUTCDate(start.getUTCDate() + daysToAdd);
  return start.toISOString().slice(0, 10);
}
