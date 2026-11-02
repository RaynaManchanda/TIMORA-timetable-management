/** Lifecycle states of a timetable version. */
export const VERSION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  DRAFT: 'DRAFT'
});

/** Read state of a notification. */
export const NOTIFICATION_STATUS = Object.freeze({
  UNREAD: 'UNREAD',
  READ: 'READ'
});

/** State of a user's Google Calendar connection. */
export const CALENDAR_AUTH_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  REAUTH_REQUIRED: 'REAUTH_REQUIRED',
  DISCONNECTED: 'DISCONNECTED'
});

/** Lifecycle states of a disruption. */
export const DISRUPTION_STATUS = Object.freeze({
  RECORDED: 'RECORDED',
  ANALYZED: 'ANALYZED',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED'
});
