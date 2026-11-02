import { AuthenticationError, ConflictError, ServiceUnavailableError, ValidationError } from '../errors/app-errors.js';
import { SECTION_ID_PATTERN } from '../constants/academic.js';
import { GoogleAuthError } from './google-calendar-client.js';
import { CALENDAR_AUTH_STATUS } from '../constants/statuses.js';
import { ROLES } from '../constants/roles.js';
import { createTimetableEntryRepository } from '../repositories/timetable-entry-repository.js';
import { createTimetableVersionRepository } from '../repositories/timetable-version-repository.js';
import { createCalendarConnectionRepository } from '../repositories/calendar-connection-repository.js';
import { buildCalendarEvents } from './calendar-event-builder.js';

const REAUTH_MESSAGE = 'Google Calendar access has expired. Please reconnect your account.';

/**
 * Create the calendar service: previews events and synchronises them with Google Calendar.
 *
 * @param {{ prisma: import('@prisma/client').PrismaClient, googleClient: object, timeZone: string, clock?: () => Date }} dependencies Collaborators.
 */
export function createCalendarService({ prisma, googleClient, tokenService, tokenCipher, timeZone, clock = () => new Date() }) {
  const versionRepository = createTimetableVersionRepository(prisma);
  const entryRepository = createTimetableEntryRepository(prisma);
  const connectionRepository = createCalendarConnectionRepository(prisma, tokenCipher);

  /**
   * Choose which entries belong to a user's calendar.
   * Students see their section, faculty see their own classes, administrators may pick a section.
   *
   * @param {object} user Authenticated user.
   * @param {string | undefined} requestedSectionId Section requested by an administrator.
   * @returns {{ sectionId?: string, facultyId?: string }}
   */
  function selectScope(user, requestedSectionId) {
    if (user.role === ROLES.STUDENT) return { sectionId: user.sectionId };
    if (user.role === ROLES.FACULTY && user.facultyId) return { facultyId: user.facultyId };
    if (!requestedSectionId || !SECTION_ID_PATTERN.test(requestedSectionId)) {
      throw new ValidationError('Choose which section to use (sectionId).');
    }
    return { sectionId: requestedSectionId };
  }

  /**
   * Build calendar events for a user from the active timetable version.
   *
   * @param {object} user Authenticated user.
   * @param {string} [requestedSectionId] Optional section filter for administrators.
   * @returns {Promise<{ count: number, timeZone: string, events: object[] }>}
   */
  async function buildEventsForUser(user, requestedSectionId) {
    const activeVersion = await versionRepository.findActive();
    const entries = activeVersion
      ? await entryRepository.findDetailed(activeVersion.id, selectScope(user, requestedSectionId))
      : [];

    return buildCalendarEvents(await keepEnrolledClasses(user, entries), { timeZone, startDate: clock() });
  }

  /**
   * A calendar holds the classes the person actually attends. A student sits ONE of the parallel
   * electives of a slot, so only the electives they enrolled in are kept; faculty keep what they
   * teach; an administrator previewing a section gets its core classes.
   *
   * @param {object} user Authenticated user.
   * @param {object[]} entries Entries in the scope of the user.
   * @returns {Promise<object[]>}
   */
  async function keepEnrolledClasses(user, entries) {
    if (user.role === ROLES.FACULTY && user.facultyId) return entries;
    const chosen = user.role === ROLES.STUDENT ? new Set(await listEnrolledElectiveIds(user.id)) : new Set();
    return entries.filter((entry) => !entry.isElective || chosen.has(entry.subjectId));
  }

  async function listEnrolledElectiveIds(userId) {
    const rows = await prisma.userElective.findMany({ where: { userId }, select: { subjectId: true } });
    return rows.map((row) => row.subjectId);
  }

  /** Distinct elective subjects taught to a section in the active timetable. */
  async function electiveOptions(sectionId) {
    const activeVersion = await versionRepository.findActive();
    if (!activeVersion) return [];
    const entries = await entryRepository.findDetailed(activeVersion.id, { sectionId });
    const bySubject = new Map();
    for (const entry of entries.filter((e) => e.isElective)) {
      if (!bySubject.has(entry.subjectId)) {
        bySubject.set(entry.subjectId, { subjectId: entry.subjectId, code: entry.subjectCode, name: entry.subjectName });
      }
    }
    return [...bySubject.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Make sure the stored Google authorisation is usable, refreshing it when possible.
   * If it cannot be refreshed the connection is flagged and the sync stops.
   *
   * @param {object} connection The user's calendar connection.
   * @returns {Promise<object>} The connection to use (with a fresh access token when it was refreshed).
   */
  async function ensureAuthorization(connection) {
    const isFlagged = connection.authStatus === CALENDAR_AUTH_STATUS.REAUTH_REQUIRED;
    const isExpired = !connection.tokenExpiresAt || connection.tokenExpiresAt <= clock();

    if (!isFlagged && !isExpired) return connection;

    if (!isFlagged && connection.canRefreshToken) {
      try {
        const refreshed = await googleClient.refreshAccessToken(connection);
        if (!refreshed?.accessToken) return connection;
        await connectionRepository.updateAccessToken(connection.userId, refreshed);
        return { ...connection, ...refreshed };
      } catch {
        // Falls through: a failed refresh means the user must authorise again.
      }
    }

    await requireReconnect(connection.userId);
  }

  /** Flag the connection and tell the user to authorise Google again. */
  async function requireReconnect(userId) {
    await connectionRepository.markReauthRequired(userId);
    throw new AuthenticationError(REAUTH_MESSAGE, { connectionStatus: CALENDAR_AUTH_STATUS.REAUTH_REQUIRED });
  }

  return {
    buildEventsForUser,

    /**
     * Report the state of a user's Google Calendar connection.
     *
     * @param {string} userId User id.
     * @returns {Promise<{ connected: boolean, authStatus: string, lastSyncedAt: Date | null, eventsCount: number }>}
     */
    async getStatus(userId) {
      const connection = await connectionRepository.findByUserId(userId);
      return {
        configured: Boolean(googleClient.isConfigured ?? true),
        googleAccountEmail: connection?.googleAccountEmail ?? null,
        connected: Boolean(connection),
        authStatus: connection?.authStatus ?? CALENDAR_AUTH_STATUS.DISCONNECTED,
        lastSyncedAt: connection?.lastSyncedAt ?? null,
        eventsCount: connection?.eventsCount ?? 0
      };
    },

    /**
     * Synchronise a user's timetable with Google Calendar.
     * Timetable data is only read, so a failed sync never changes it.
     *
     * @param {object} user Authenticated user.
     * @returns {Promise<{ eventsCount: number, timeZone: string, message: string }>}
     */
    async syncUserCalendar(user, sectionId) {
      const connection = await connectionRepository.findByUserId(user.id);
      if (!connection) {
        throw new ConflictError('Google Calendar is not connected. Please connect your account first.', {
          connectionStatus: CALENDAR_AUTH_STATUS.DISCONNECTED
        });
      }

      const usable = await ensureAuthorization(connection);

      const { events, count } = await buildEventsForUser(user, sectionId);
      let pushedIds;
      try {
        pushedIds = (await googleClient.pushEvents(usable, events)) ?? [];
        // Remove what an earlier sync created but no longer applies (another section or elective),
        // so the calendar never holds the old and the new timetable side by side.
        const stale = (connection.syncedEventIds ?? []).filter((id) => !pushedIds.includes(id));
        if (stale.length > 0) await googleClient.deleteEvents?.(usable, stale);
      } catch (error) {
        if (error instanceof GoogleAuthError) await requireReconnect(user.id);
        throw error;
      }
      await connectionRepository.recordSync(user.id, count, clock(), pushedIds);

      return {
        eventsCount: count,
        timeZone,
        message: `Successfully synchronized ${count} recurring timetable events to Google Calendar.`
      };
    },

    /**
     * Store a Google authorisation for a user. Called by the OAuth callback.
     *
     * @param {{ userId: string, googleAccountEmail?: string, tokenExpiresAt: Date, canRefreshToken: boolean }} connection Connection details.
     * @returns {Promise<void>}
     */
    saveConnection(connection) {
      return connectionRepository.save(connection);
    },

    /**
     * The elective classes a student can enrol in (those of their section) and the ones chosen.
     *
     * @param {object} user Authenticated user.
     * @returns {Promise<{ options: object[], selected: string[] }>}
     */
    async getElectives(user) {
      if (user.role !== ROLES.STUDENT || !user.sectionId) return { options: [], selected: [] };
      return { options: await electiveOptions(user.sectionId), selected: await listEnrolledElectiveIds(user.id) };
    },

    /**
     * Replace the elective enrolment of a student. Only electives of their own section are accepted.
     *
     * @param {object} user Authenticated student.
     * @param {unknown} subjectIds Chosen subject ids.
     * @returns {Promise<{ selected: string[] }>}
     */
    async setElectives(user, subjectIds) {
      if (user.role !== ROLES.STUDENT || !user.sectionId) throw new ValidationError('Only students enrol in electives.');
      if (!Array.isArray(subjectIds) || subjectIds.length > 20 || !subjectIds.every((id) => typeof id === 'string')) {
        throw new ValidationError('subjectIds must be a list of subject ids');
      }
      const allowed = new Set((await electiveOptions(user.sectionId)).map((option) => option.subjectId));
      const unknown = subjectIds.find((id) => !allowed.has(id));
      if (unknown) throw new ValidationError(`${unknown} is not an elective of your section`);

      const unique = [...new Set(subjectIds)];
      await prisma.$transaction([
        prisma.userElective.deleteMany({ where: { userId: user.id } }),
        prisma.userElective.createMany({ data: unique.map((subjectId) => ({ userId: user.id, subjectId })) })
      ]);
      return { selected: unique };
    },

    /**
     * Step 1 of connecting: the address of Google's consent screen for this user.
     *
     * @param {string} userId Signed-in user.
     * @returns {{ url: string }}
     */
    startConnection(userId) {
      if (!googleClient.isConfigured) {
        throw new ServiceUnavailableError(
          'Google Calendar is not configured on the server. An administrator must set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI in the server environment (.env).'
        );
      }
      return { url: googleClient.buildAuthUrl(tokenService.issueState(userId)) };
    },

    /**
     * Step 2: Google sent the browser back with a code. Only the user who started the flow may finish it.
     *
     * @param {string} userId Signed-in user.
     * @param {{ code?: string, state?: string }} body Values from the redirect.
     * @returns {Promise<{ googleAccountEmail: string | null }>}
     */
    async completeConnection(userId, { code, state } = {}) {
      if (typeof code !== 'string' || typeof state !== 'string' || !code || !state) {
        throw new ValidationError('code and state are required');
      }
      if (tokenService.verifyState(state) !== userId) {
        throw new AuthenticationError('This Google sign-in was started by a different account.');
      }

      let tokens;
      try {
        tokens = await googleClient.exchangeCode(code);
      } catch (error) {
        if (error instanceof GoogleAuthError) {
          throw new ValidationError('Google did not accept the authorisation (the code may have expired). Please try again.');
        }
        throw error;
      }

      const existing = await connectionRepository.findByUserId(userId);
      if (!tokens.refreshToken && !existing?.refreshToken) {
        throw new ValidationError('Google did not grant offline access. Remove TIMORA from your Google account permissions and connect again.');
      }
      await connectionRepository.save({ userId, ...tokens });
      return { googleAccountEmail: tokens.googleAccountEmail };
    },

    /**
     * Forget the connection and ask Google to revoke the access.
     *
     * @param {string} userId Signed-in user.
     * @returns {Promise<void>}
     */
    async disconnect(userId) {
      const connection = await connectionRepository.findByUserId(userId);
      if (connection) await googleClient.revoke?.(connection);
      await connectionRepository.remove(userId);
    }
  };
}
