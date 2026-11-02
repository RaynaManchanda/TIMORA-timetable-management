import express from 'express';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * Notification routes, mounted at /api/notifications. Every route needs a valid token.
 *
 * @param {{ notificationService: object, auth: { authenticate: Function, requireAdmin: Function } }} dependencies Collaborators.
 * @returns {import('express').Router}
 */
export function createNotificationRoutes({ notificationService, auth }) {
  const router = express.Router();

  router.use(auth.authenticate);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const notifications = await notificationService.listUnread(req.user.id);
      res.json({ success: true, count: notifications.length, notifications });
    })
  );

  router.post(
    '/read-all',
    asyncHandler(async (req, res) => {
      const result = await notificationService.markAllAsRead(req.user.id);
      res.json({ success: true, message: 'All notifications marked as read.', ...result });
    })
  );

  router.patch(
    '/:id/read',
    asyncHandler(async (req, res) => {
      const result = await notificationService.markAsRead(req.params.id, req.user.id);
      res.json({ success: true, message: 'Notification marked as read.', ...result });
    })
  );

  router.post(
    '/reschedule-notify',
    auth.requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await notificationService.notifyRescheduleApproved(req.body);
      res.status(201).json({ success: true, ...result });
    })
  );

  return router;
}
