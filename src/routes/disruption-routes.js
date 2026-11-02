/**
 * TIMORA - Disruption Routes
 * Recording, listing and impact analysis of disruptions. Administrators only.
 */

import express from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validateIdParam } from '../validation/academic-validator.js';

/**
 * Disruption routes, mounted at /api/rescheduling/disruptions.
 *
 * @param {{ adaptiveService: object, auth: { authenticate: Function, requireAdmin: Function } }} dependencies Collaborators.
 * @returns {import('express').Router}
 */
export function createDisruptionRoutes({ adaptiveService, auth }) {
  const router = express.Router();
  router.use(auth.authenticate, auth.requireAdmin);

  router.post('/', asyncHandler(async (req, res) => {
    const disruption = await adaptiveService.recordDisruption(req.body ?? {}, req.user);
    res.status(201).json({ success: true, message: 'Disruption recorded successfully.', disruption });
  }));

  router.get('/', asyncHandler(async (req, res) => {
    const disruptions = await adaptiveService.listDisruptions();
    res.json({ success: true, count: disruptions.length, disruptions });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    res.json({ success: true, disruption: await adaptiveService.getDisruption(validateIdParam(req.params.id)) });
  }));

  router.post('/:id/analyze', asyncHandler(async (req, res) => {
    res.json({ success: true, impactResult: await adaptiveService.analyzeDisruption(validateIdParam(req.params.id)) });
  }));

  return router;
}
