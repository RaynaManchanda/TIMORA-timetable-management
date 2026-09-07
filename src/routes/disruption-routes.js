/**
 * TIMORA - Disruption Routes
 * API endpoints for disruption recording, listing, and impact analysis.
 */

import express from 'express';
import { disruptionService } from '../adaptive/disruption/disruption-service.js';
import { impactAnalyzer } from '../adaptive/impact/impact-analyzer.js';

const router = express.Router();

// Record a new disruption
router.post('/', (req, res) => {
  try {
    const disruption = disruptionService.recordDisruption(req.body);
    res.status(201).json({
      success: true,
      message: 'Disruption recorded successfully.',
      disruption
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// List all recorded disruptions
router.get('/', (req, res) => {
  try {
    const disruptions = disruptionService.getAllDisruptions();
    res.json({ success: true, count: disruptions.length, disruptions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get disruption by ID
router.get('/:id', (req, res) => {
  try {
    const disruption = disruptionService.getDisruptionById(req.params.id);
    if (!disruption) {
      return res.status(404).json({ success: false, error: 'Disruption not found.' });
    }
    res.json({ success: true, disruption });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run targeted impact analysis for a disruption
router.post('/:id/analyze', (req, res) => {
  try {
    const disruption = disruptionService.getDisruptionById(req.params.id);
    if (!disruption) {
      return res.status(404).json({ success: false, error: 'Disruption not found.' });
    }

    const impactResult = impactAnalyzer.analyzeImpact(disruption);
    disruptionService.updateDisruptionStatus(disruption.id, 'ANALYZED');

    res.json({
      success: true,
      impactResult
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
