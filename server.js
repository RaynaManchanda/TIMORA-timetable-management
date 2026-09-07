/**
 * TIMORA - Server Entry Point
 * Adaptive Scheduling / Rescheduling + AI Assistance Module
 */

import express from 'express';
import cors from 'cors';

import disruptionRoutes from './src/routes/disruption-routes.js';
import reschedulingRoutes from './src/routes/rescheduling-routes.js';
import aiRoutes from './src/routes/ai-routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Mount API Routers
app.use('/api/rescheduling/disruptions', disruptionRoutes);
app.use('/api/rescheduling', reschedulingRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    module: 'Adaptive Scheduling / Rescheduling + AI Assistance',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` TIMORA Adaptive Scheduling + AI Module running on:`);
    console.log(` http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

export default app;
