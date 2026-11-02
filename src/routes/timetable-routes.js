import express from 'express';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * Timetable routes, mounted at /api/timetables. Every route needs a valid token.
 *
 * @param {{ timetableService: object, auth: { authenticate: Function, requireAdmin: Function } }} dependencies Collaborators.
 * @returns {import('express').Router}
 */
export function createTimetableRoutes({ timetableService, auth }) {
  const router = express.Router();

  router.use(auth.authenticate);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const entries = await timetableService.listEntries(req.query, req.user);
      res.json({ success: true, count: entries.length, entries });
    })
  );

  router.post(
    '/',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const entry = await timetableService.createEntry(req.body);
      res.status(201).json({ success: true, message: 'Timetable entry created successfully.', entry });
    })
  );

  router.get(
    '/versions',
    asyncHandler(async (req, res) => {
      const versions = await timetableService.listVersions();
      res.json({ success: true, count: versions.length, versions });
    })
  );

  router.post(
    '/versions',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await timetableService.saveVersion(req.body, req.user);
      res.status(201).json({ success: true, message: 'Timetable version saved.', ...result });
    })
  );

  return router;
}
