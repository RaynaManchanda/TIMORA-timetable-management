import express from 'express';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * Google Calendar routes, mounted at /api/calendar. Every route needs a valid token.
 *
 * @param {{ calendarService: object, auth: { authenticate: Function } }} dependencies Collaborators.
 * @returns {import('express').Router}
 */
export function createCalendarRoutes({ calendarService, auth }) {
  const router = express.Router();

  router.use(auth.authenticate);

  router.get(
    '/events',
    asyncHandler(async (req, res) => {
      const result = await calendarService.buildEventsForUser(req.user, typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined);
      res.json({ success: true, ...result });
    })
  );

  router.get(
    '/status',
    asyncHandler(async (req, res) => {
      const status = await calendarService.getStatus(req.user.id);
      res.json({ success: true, ...status });
    })
  );

  // Connecting a Google account: the browser is sent to Google, which returns it to the app with a
  // code that the frontend hands back here (so only the signed-in user can complete the connection).
  // Which of the parallel elective classes a student attends (only those go to their calendar).
  router.get(
    '/electives',
    asyncHandler(async (req, res) => {
      res.json({ success: true, ...(await calendarService.getElectives(req.user)) });
    })
  );

  router.put(
    '/electives',
    asyncHandler(async (req, res) => {
      const result = await calendarService.setElectives(req.user, req.body?.subjectIds);
      res.json({ success: true, message: 'Your electives were saved.', ...result });
    })
  );

  router.post(
    '/connect',
    asyncHandler(async (req, res) => {
      res.json({ success: true, ...calendarService.startConnection(req.user.id) });
    })
  );

  router.post(
    '/connect/complete',
    asyncHandler(async (req, res) => {
      const result = await calendarService.completeConnection(req.user.id, req.body ?? {});
      res.json({ success: true, message: 'Google Calendar connected.', ...result });
    })
  );

  router.post(
    '/disconnect',
    asyncHandler(async (req, res) => {
      await calendarService.disconnect(req.user.id);
      res.json({ success: true, message: 'Google Calendar disconnected.' });
    })
  );

  router.post(
    '/sync',
    asyncHandler(async (req, res) => {
      const result = await calendarService.syncUserCalendar(req.user, typeof req.body?.sectionId === 'string' ? req.body.sectionId : undefined);
      res.json({ success: true, connectionStatus: 'CONNECTED', ...result });
    })
  );

  return router;
}
