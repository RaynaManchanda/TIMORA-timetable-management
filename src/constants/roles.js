/** User roles supported by the platform. */
export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  COORDINATOR: 'COORDINATOR',
  FACULTY: 'FACULTY',
  STUDENT: 'STUDENT'
});

/** Roles that may manage timetables and generate schedules. */
export const ADMIN_ROLES = Object.freeze([ROLES.ADMIN, ROLES.COORDINATOR]);

/** Roles a visitor may choose when creating an account without an administrator. */
export const SELF_REGISTRATION_ROLES = Object.freeze([ROLES.STUDENT, ROLES.FACULTY]);
