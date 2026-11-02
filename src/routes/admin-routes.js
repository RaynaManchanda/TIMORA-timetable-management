/**
 * TIMORA - Administrator Routes
 * Role-protected endpoints that generate, publish and discard timetable drafts.
 */

import express from 'express';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * Administrator routes, mounted at /api/admin. Only ADMIN and COORDINATOR users may call them.
 *
 * @param {{ auth: { authenticate: Function, requireAdmin: Function }, generationService: object }} dependencies Collaborators.
 * @returns {import('express').Router}
 */
export function createAdminRoutes({ auth, generationService }) {
  const router = express.Router();

  router.use(auth.authenticate, auth.requireAdmin);

  router.post(
    '/timetables/generate',
    asyncHandler(async (req, res) => {
      const result = await generationService.generateDraft(req.body, req.user);
      res.json({ success: true, message: 'Timetable generated successfully. Review the draft before publishing it.', ...result });
    })
  );

  router.post(
    '/timetables/drafts/:id/publish',
    asyncHandler(async (req, res) => {
      const version = await generationService.publishDraft(req.params.id, req.user);
      res.json({ success: true, message: `Draft published as ${version.versionNumber}.`, version });
    })
  );

  router.delete(
    '/timetables/drafts/:id',
    asyncHandler(async (req, res) => {
      await generationService.discardDraft(req.params.id);
      res.json({ success: true, message: 'Draft discarded.' });
    })
  );

  return router;
}
