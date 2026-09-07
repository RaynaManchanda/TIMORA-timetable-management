/**
 * TIMORA - Disruption Model & Types
 */

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

export class Disruption {
  constructor({
    id,
    disruptionType,
    affectedEntityType, // FACULTY, ROOM, SECTION, TIMETABLE_ENTRY
    affectedEntityId,
    dayOfWeek,         // e.g., 'Tuesday'
    date,               // e.g., '2026-09-08'
    slotId,             // optional slot ID e.g. 'S2'
    reason,
    status = DISRUPTION_STATUS.RECORDED,
    createdAt = new Date().toISOString()
  }) {
    this.id = id || `DIS_${Date.now()}`;
    this.disruptionType = disruptionType;
    this.affectedEntityType = affectedEntityType;
    this.affectedEntityId = affectedEntityId;
    this.dayOfWeek = dayOfWeek;
    this.date = date;
    this.slotId = slotId || null;
    this.reason = reason || 'Unspecified disruption';
    this.status = status;
    this.createdAt = createdAt;

    this.validate();
  }

  validate() {
    if (!Object.values(DISRUPTION_TYPES).includes(this.disruptionType)) {
      throw new Error(`Invalid disruption type: ${this.disruptionType}`);
    }
    if (!this.affectedEntityId) {
      throw new Error('Disruption requires an affected entity ID.');
    }
    if (!this.dayOfWeek) {
      throw new Error('Disruption requires a valid day of the week.');
    }
  }
}
