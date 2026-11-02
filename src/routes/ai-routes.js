/**
 * TIMORA - AI Assistant Routes
 * Natural-language interpretation, the mandatory human validation step and schedule explanations.
 * Administrators only: the assistant only ever proposes, a person confirms.
 */

import express from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { ValidationError } from '../errors/app-errors.js';
import { aiAssistantService } from '../ai/ai-assistant-service.js';

const MAX_PROMPT_LENGTH = 1000;

/**
 * Run an assistant call and report its failures as validation errors (400).
 *
 * @param {() => Promise<unknown> | unknown} call Assistant call.
 * @returns {Promise<unknown>}
 */
async function asValidation(call) {
  try {
    return await call();
  } catch (error) {
    throw new ValidationError(error.message);
  }
}

/**
 * AI routes, mounted at /api/ai.
 *
 * @param {{ adaptiveService: object, auth: { authenticate: Function, requireAdmin: Function } }} dependencies Collaborators.
 * @returns {import('express').Router}
 */
export function createAiRoutes({ adaptiveService, auth }) {
  const router = express.Router();
  router.use(auth.authenticate, auth.requireAdmin);

  // Step 1: interpret a natural-language prompt
  router.post('/interpret', asyncHandler(async (req, res) => {
    const { prompt } = req.body ?? {};
    if (typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
      throw new ValidationError(`prompt must be at most ${MAX_PROMPT_LENGTH} characters`);
    }
    const catalog = await adaptiveService.getAiCatalog();
    const result = await asValidation(() => aiAssistantService.interpretConstraint(prompt, catalog));
    res.json({ success: true, result });
  }));

  // Step 2: human validation wrapper
  router.post('/validate', asyncHandler(async (req, res) => {
    const { interpretedResult, adminCorrections } = req.body ?? {};
    const validatedResult = await asValidation(() => aiAssistantService.validateConstraint(interpretedResult, adminCorrections));
    res.json({ success: true, validatedResult });
  }));

  // Step 3: explain an alternative option from its calculated metrics
  router.post('/explain', asyncHandler(async (req, res) => {
    const { alternative, disruption } = req.body ?? {};
    const explanation = await asValidation(() => aiAssistantService.generateExplanation(alternative, disruption));
    res.json({ success: true, explanation });
  }));

  return router;
}
