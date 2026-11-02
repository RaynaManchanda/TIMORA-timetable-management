/**
 * TIMORA - Disruption Model & Types
 */

import { DAYS_OF_WEEK, SLOT_IDS } from '../../constants/academic.js';
import { generateId } from '../../utils/id-generator.js';

export const DISRUPTION_TYPES = {
  FACULTY_ABSENCE: 'FACULTY_ABSENCE',
  FACULTY_UNAVAILABILITY: 'FACULTY_UNAVAILABILITY',
  CLASS_CANCELLATION: 'CLASS_CANCELLATION',
  ROOM_UNAVAILABILITY: 'ROOM_UNAVAILABILITY',
  INSTITUTIONAL_EVENT: 'INSTITUTIONAL_EVENT',
  HOLIDAY: 'HOLIDAY',
  SWAP_REQUEST: 'SWAP_REQUEST',
  MAKEUP_SESSION: 'MAKEUP_SESSION'
};

export const DISRUPTION_STATUS = {
  RECORDED: 'RECORDED',
  ANALYZED: 'ANALYZED',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED'
};

export const AFFECTED_ENTITY_TYPES = ['FACULTY', 'ROOM', 'SECTION', 'TIMETABLE_ENTRY', 'TIMETABLE'];

const MAX_REASON_LENGTH = 500;

/**
 * "tuesday" / "TUESDAY" -> "Tuesday". Returns the input unchanged when it is not a day name.
 *
 * @param {unknown} day Day in any case.
 * @returns {unknown}
 */
function normaliseDay(day) {
  if (typeof day !== 'string') return day;
  const match = DAYS_OF_WEEK.find((name) => name.toLowerCase() === day.trim().toLowerCase());
  return match ?? day;
}

export class Disruption {
  constructor({
    id,
    disruptionType,
    affectedEntityType, // FACULTY, ROOM, SECTION, TIMETABLE_ENTRY
    affectedEntityId,
    affectedEntityName,
    dayOfWeek, // e.g., 'Tuesday'
    date, // e.g., '2026-09-08'
    slotId, // optional slot ID e.g. 'S2'
    reason,
    reportedBy,
    status = DISRUPTION_STATUS.RECORDED,
    createdAt = new Date().toISOString()
  }) {
    this.id = id || generateId('DIS');
    this.disruptionType = disruptionType;
    this.affectedEntityType = affectedEntityType || inferEntityType(disruptionType);
    this.affectedEntityId = typeof affectedEntityId === 'string' ? affectedEntityId.trim() : affectedEntityId;
    if (!this.affectedEntityId && this.affectedEntityType === 'TIMETABLE') this.affectedEntityId = 'ALL';
    this.affectedEntityName = affectedEntityName || null;
    this.dayOfWeek = normaliseDay(dayOfWeek);
    this.date = date || null;
    this.slotId = slotId ? String(slotId).trim().toUpperCase() : null;
    this.reason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'Unspecified disruption';
    this.reportedBy = reportedBy || null;
    this.status = status;
    this.createdAt = createdAt;

    this.validate();
  }

  validate() {
    if (!Object.values(DISRUPTION_TYPES).includes(this.disruptionType)) {
      throw new Error(`Invalid disruption type: ${this.disruptionType}`);
    }
    if (!AFFECTED_ENTITY_TYPES.includes(this.affectedEntityType)) {
      throw new Error(`Invalid affected entity type: ${this.affectedEntityType}`);
    }
    if (!this.affectedEntityId || typeof this.affectedEntityId !== 'string' || this.affectedEntityId.length > 64) {
      throw new Error('Disruption requires an affected entity ID.');
    }
    if (!this.dayOfWeek || !DAYS_OF_WEEK.includes(this.dayOfWeek)) {
      throw new Error('Disruption requires a valid day of the week.');
    }
    if (this.slotId && !SLOT_IDS.includes(this.slotId)) {
      throw new Error(`Invalid time slot: ${this.slotId}`);
    }
    if (this.reason.length > MAX_REASON_LENGTH) {
      throw new Error(`Reason must be at most ${MAX_REASON_LENGTH} characters.`);
    }
    if (this.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(this.date)) {
      throw new Error('Date must be formatted as YYYY-MM-DD.');
    }
  }
}

/**
 * Entity type implied by the disruption type, used when the client does not send one.
 *
 * @param {string} disruptionType Disruption type.
 * @returns {string}
 */
function inferEntityType(disruptionType) {
  if (disruptionType === DISRUPTION_TYPES.ROOM_UNAVAILABILITY) return 'ROOM';
  if (disruptionType === DISRUPTION_TYPES.CLASS_CANCELLATION) return 'TIMETABLE_ENTRY';
  if (disruptionType === DISRUPTION_TYPES.HOLIDAY || disruptionType === DISRUPTION_TYPES.INSTITUTIONAL_EVENT) return 'TIMETABLE';
  return 'FACULTY';
}
