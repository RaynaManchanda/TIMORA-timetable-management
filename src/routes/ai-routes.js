/**
 * TIMORA - AI Assistant Routes
 * API endpoints for natural language interpretation, human validation wrappers, and schedule explanations.
 */

import express from 'express';
import { aiAssistantService } from '../ai/ai-assistant-service.js';

const router = express.Router();

// Step 1: Interpret natural language prompt
router.post('/interpret', async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await aiAssistantService.interpretConstraint(prompt);
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Step 2: Human validation wrapper
router.post('/validate', (req, res) => {
  try {
    const { interpretedResult, adminCorrections } = req.body;
    const validatedResult = aiAssistantService.validateConstraint(interpretedResult, adminCorrections);
    res.json({ success: true, validatedResult });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Step 3: Generate AI explanation for an alternative option
router.post('/explain', (req, res) => {
  try {
    const { alternative, disruption } = req.body;
    const explanation = aiAssistantService.generateExplanation(alternative, disruption);
    res.json({ success: true, explanation });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
