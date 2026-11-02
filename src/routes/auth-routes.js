import express from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * Per-IP limiter for the public authentication endpoints. It complements the per-account lockout:
 * the lockout protects one account, this protects the server from one address trying many accounts.
 *
 * @param {{ windowMinutes: number, maxRequests: number } | undefined} settings Limit settings; 0 requests disables it.
 * @returns {Function}
 */
function createIpLimiter(settings) {
  if (!settings || settings.maxRequests <= 0) return (req, res, next) => next();

  return rateLimit({
    windowMs: settings.windowMinutes * 60 * 1000,
    limit: settings.maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      const message = 'Too many requests from this address. Please try again later.';
      res.status(429).json({ success: false, error: message, message });
    }
  });
}

/**
 * Authentication routes, mounted at /api/auth.
 *
 * @param {{ authService: object, authenticate: Function, authRateLimit?: object }} dependencies Collaborators.
 * @returns {import('express').Router}
 */
export function createAuthRoutes({ authService, authenticate, authRateLimit }) {
  const router = express.Router();
  const ipLimiter = createIpLimiter(authRateLimit);

  router.post(
    '/register',
    ipLimiter,
    asyncHandler(async (req, res) => {
      const user = await authService.register(req.body);
      res.status(201).json({ success: true, message: 'User registered successfully.', user });
    })
  );

  router.post(
    '/login',
    ipLimiter,
    asyncHandler(async (req, res) => {
      const result = await authService.login(req.body);
      res.status(200).json({ success: true, message: 'Login successful.', ...result });
    })
  );

  router.get(
    '/me',
    authenticate,
    asyncHandler(async (req, res) => {
      res.json({ success: true, user: await authService.getProfile(req.user.id) });
    })
  );

  router.post(
    '/change-password',
    ipLimiter,
    authenticate,
    asyncHandler(async (req, res) => {
      const result = await authService.changePassword(req.user.id, req.body);
      res.json({ success: true, message: 'Password changed. All other sessions were signed out.', ...result });
    })
  );

  router.post(
    '/logout-all',
    authenticate,
    asyncHandler(async (req, res) => {
      await authService.logoutEverywhere(req.user.id);
      res.json({ success: true, message: 'Signed out of all devices.' });
    })
  );

  return router;
}
