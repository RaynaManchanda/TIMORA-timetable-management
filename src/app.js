import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { createAuthRoutes } from './routes/auth-routes.js';
import { createTimetableRoutes } from './routes/timetable-routes.js';
import { createAdminRoutes } from './routes/admin-routes.js';
import { createNotificationRoutes } from './routes/notification-routes.js';
import { createCalendarRoutes } from './routes/calendar-routes.js';
import { createAcademicRoutes } from './routes/academic-routes.js';
import { createHealthRoutes } from './routes/health-routes.js';
import { createReschedulingRoutes } from './routes/rescheduling-routes.js';
import { createDisruptionRoutes } from './routes/disruption-routes.js';
import { createAiRoutes } from './routes/ai-routes.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/**
 * Build the CORS middleware. The bundled frontend is served from the same origin and needs no CORS;
 * other origins are only allowed when listed in CORS_ORIGINS.
 *
 * @param {string[]} allowedOrigins Origins allowed to call the API from a browser.
 * @returns {Function}
 */
function createCors(allowedOrigins) {
  if (allowedOrigins.length === 0) return (req, res, next) => next();

  return cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
  });
}

/**
 * Create the Express application.
 * No port is opened here, so tests can drive the app directly.
 *
 * @param {{ services: object, config?: object, logger?: { error: Function } }} options Services from createServices, configuration and an optional logger.
 * @returns {import('express').Express}
 */
export function createApp({ services, config = {}, logger = console }) {
  const { auth, prisma, authService, timetableService, notificationService, calendarService } = services;
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"]
        }
      }
    })
  );
  app.use(createCors(config.corsOrigins ?? []));
  app.use(express.json({ limit: '256kb' }));

  // API responses carry personal data and must never be cached by browsers or proxies.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api/health', createHealthRoutes({ prisma }));
  app.use('/api/auth', createAuthRoutes({ authService, authenticate: auth.authenticate, authRateLimit: config.authRateLimit }));
  app.use('/api/timetables', createTimetableRoutes({ timetableService, auth }));
  app.use('/api/admin', createAdminRoutes({ auth, generationService: services.generationService }));
  app.use('/api/notifications', createNotificationRoutes({ notificationService, auth }));
  app.use('/api/calendar', createCalendarRoutes({ calendarService, auth }));
  app.use('/api/academic', createAcademicRoutes({ auth, academicRepository: services.academicRepository }));

  app.use('/api/rescheduling/disruptions', createDisruptionRoutes({ adaptiveService: services.adaptiveService, auth }));
  app.use('/api/rescheduling', createReschedulingRoutes({ adaptiveService: services.adaptiveService, auth }));
  app.use('/api/ai', createAiRoutes({ adaptiveService: services.adaptiveService, auth }));

  app.use('/api', notFoundHandler);

  // The frontend. Mounted after the API so API calls never pay for a file-system lookup.
  app.use(express.static(PUBLIC_DIR));

  app.use(createErrorHandler(logger));

  return app;
}
