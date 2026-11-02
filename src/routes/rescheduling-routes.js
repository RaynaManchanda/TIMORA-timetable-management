/**
 * TIMORA - Rescheduling Routes
 * Alternative generation, comparison, human approval, versioning and rollback, plus the reference
 * data the frontend needs. Every route needs a valid token; changes need an administrator.
 */

import express from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { ADMIN_ROLES, ROLES } from '../constants/roles.js';
import { ValidationError } from '../errors/app-errors.js';
import { sectionsOf } from '../adapters/scheduling-engine-adapter.js';
import { validateIdParam } from '../validation/academic-validator.js';
import { presentFaculty } from './academic-routes.js';

/**
 * Limit timetable entries to what a user may see: students see their section, faculty their own classes.
 *
 * @param {object[]} entries Entries in engine shape.
 * @param {{ role: string, sectionId?: string, facultyId?: string }} user Requesting user.
 * @returns {object[]}
 */
export function scopeEntriesForUser(entries, user) {
  if (ADMIN_ROLES.includes(user.role)) return entries;
  if (user.role === ROLES.STUDENT) {
    return user.sectionId ? entries.filter((entry) => sectionsOf(entry).includes(user.sectionId)) : [];
  }
  if (user.role === ROLES.FACULTY) {
    return user.facultyId ? entries.filter((entry) => entry.facultyId === user.facultyId) : [];
  }
  return [];
}

/**
 * Adaptive rescheduling routes, mounted at /api/rescheduling.
 *
 * @param {{ adaptiveService: object, auth: { authenticate: Function, requireAdmin: Function } }} dependencies Collaborators.
 * @returns {import('express').Router}
 */
export function createReschedulingRoutes({ adaptiveService, auth }) {
  const router = express.Router();
  router.use(auth.authenticate);

  // Reference data for the forms and grids (contact details only for administrators).
  router.get('/metadata', asyncHandler(async (req, res) => {
    const metadata = await adaptiveService.getMetadata();
    const isAdmin = ADMIN_ROLES.includes(req.user.role);
    res.json({
      success: true,
      ...metadata,
      faculty: metadata.faculty.map((person) => presentFaculty(person, req.user)),
      blocks: isAdmin ? metadata.blocks : metadata.blocks.filter((block) => block.sectionId === req.user.sectionId)
    });
  }));

  // Active timetable (scoped to the caller) and, for administrators, the version history.
  router.get('/versions', asyncHandler(async (req, res) => {
    const isAdmin = ADMIN_ROLES.includes(req.user.role);
    const { activeVersion, versions } = await adaptiveService.getVersionOverview({ withMetrics: isAdmin });
    const visible = { ...activeVersion, entries: scopeEntriesForUser(activeVersion.entries, req.user) };

    res.json({
      success: true,
      activeVersionId: activeVersion.id,
      activeVersion: isAdmin ? visible : { ...visible, changeLog: undefined, approvedBy: undefined },
      count: isAdmin ? versions.length : 1,
      versions: isAdmin ? versions : [visible]
    });
  }));

  router.get('/versions/:id', auth.requireAdmin, asyncHandler(async (req, res) => {
    res.json({ success: true, version: await adaptiveService.getVersion(validateIdParam(req.params.id)) });
  }));

  router.post('/versions/:id/rollback', auth.requireAdmin, asyncHandler(async (req, res) => {
    const targetVersion = await adaptiveService.rollbackToVersion(validateIdParam(req.params.id));
    res.json({
      success: true,
      message: `Successfully rolled back to version ${targetVersion.versionNumber} (${targetVersion.name}).`,
      activeVersion: targetVersion
    });
  }));

  // Everything below changes or reveals planning data: administrators only.
  router.post('/generate-alternatives', auth.requireAdmin, asyncHandler(async (req, res) => {
    const { disruptionId } = req.body ?? {};
    if (!disruptionId) throw new ValidationError('Disruption ID is required.');

    const { impactResult, comparisonPayload } = await adaptiveService.generateAlternatives(disruptionId);
    res.json({ success: true, impactResult, comparisonPayload });
  }));

  router.post('/compare-alternatives', auth.requireAdmin, asyncHandler(async (req, res) => {
    const { disruptionId } = req.body ?? {};
    if (!disruptionId) throw new ValidationError('Disruption ID is required.');
    res.json({ success: true, comparison: await adaptiveService.compareAlternatives(disruptionId) });
  }));

  // Human administrator approval. The chosen alternative is rebuilt on the server.
  router.post('/approve', auth.requireAdmin, asyncHandler(async (req, res) => {
    const { disruptionId, alternativeId, approvalNotes } = req.body ?? {};
    const result = await adaptiveService.approveAlternative({ disruptionId, alternativeId, approvalNotes }, req.user);
    res.json({ success: true, ...result });
  }));

  router.get('/approvals', auth.requireAdmin, asyncHandler(async (req, res) => {
    const approvals = await adaptiveService.listApprovalHistory();
    res.json({ success: true, count: approvals.length, approvals });
  }));

  return router;
}
