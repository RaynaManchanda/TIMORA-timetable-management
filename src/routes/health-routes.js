import express from 'express';

/**
 * Health check route, mounted at /api/health. It is public so load balancers can call it.
 * Reports the database as DOWN, with HTTP 503, when a trivial query fails.
 *
 * @param {{ prisma: import('@prisma/client').PrismaClient }} dependencies Collaborators.
 * @returns {import('express').Router}
 */
export function createHealthRoutes({ prisma }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    let database = 'UP';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'DOWN';
    }

    const status = database === 'UP' ? 'UP' : 'DOWN';
    res.status(status === 'UP' ? 200 : 503).json({
      status,
      api: 'UP',
      database,
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
