/**
 * TIMORA - Rescheduling Routes
 * API endpoints for alternative generation, comparison, human approval, versioning, and rollback.
 */

import express from 'express';
import { disruptionService } from '../adaptive/disruption/disruption-service.js';
import { impactAnalyzer } from '../adaptive/impact/impact-analyzer.js';
import { reschedulingEngine } from '../adaptive/rescheduling/rescheduling-engine.js';
import { alternativeComparator } from '../adaptive/rescheduling/alternative-comparator.js';
import { approvalService } from '../adaptive/approval/approval-service.js';
import { versionService } from '../adaptive/versioning/version-service.js';
import { timetableRepository } from '../repositories/timetable-repository.js';
import { aiAssistantService } from '../ai/ai-assistant-service.js';

const router = express.Router();

// Generate alternative schedules for a disruption
router.post('/generate-alternatives', (req, res) => {
  try {
    const { disruptionId } = req.body;
    if (!disruptionId) {
      return res.status(400).json({ success: false, error: 'Disruption ID is required.' });
    }

    const disruption = disruptionService.getDisruptionById(disruptionId);
    if (!disruption) {
      return res.status(404).json({ success: false, error: 'Disruption not found.' });
    }

    const impactResult = impactAnalyzer.analyzeImpact(disruption);
    const alternatives = reschedulingEngine.generateAlternatives(impactResult);

    // Attach AI explanations to alternatives
    alternatives.forEach(alt => {
      alt.explanation = aiAssistantService.generateExplanation(alt, disruption);
    });

    const comparisonPayload = alternativeComparator.compareAlternatives(alternatives, disruption);

    res.json({
      success: true,
      impactResult,
      comparisonPayload
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Side-by-side comparison payload
router.post('/compare-alternatives', (req, res) => {
  try {
    const { alternatives, disruptionId } = req.body;
    const disruption = disruptionService.getDisruptionById(disruptionId);
    const comparison = alternativeComparator.compareAlternatives(alternatives, disruption || { id: disruptionId });

    res.json({ success: true, comparison });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Human Administrator Approval
router.post('/approve', (req, res) => {
  try {
    const { alternative, disruptionId, approvedBy, approvalNotes } = req.body;

    const result = approvalService.approveAlternative({
      alternative,
      disruptionId,
      approvedBy: approvedBy || 'System Admin',
      approvalNotes
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get active timetable and version history
router.get('/versions', (req, res) => {
  try {
    const versions = versionService.getVersionHistory();
    const activeVersion = versionService.getActiveVersion();

    res.json({
      success: true,
      activeVersionId: activeVersion.id,
      activeVersion,
      count: versions.length,
      versions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific timetable version by ID
router.get('/versions/:id', (req, res) => {
  try {
    const version = versionService.getVersionById(req.params.id);
    if (!version) {
      return res.status(404).json({ success: false, error: 'Version not found.' });
    }
    res.json({ success: true, version });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rollback active timetable to target version ID
router.post('/versions/:id/rollback', (req, res) => {
  try {
    const targetVersion = versionService.rollbackToVersion(req.params.id);
    res.json({
      success: true,
      message: `Successfully rolled back to version ${targetVersion.versionNumber} (${targetVersion.name}).`,
      activeVersion: targetVersion
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Helper endpoint: Get System Metadata (Faculty, Rooms, Sections, Subjects, Slots)
router.get('/metadata', (req, res) => {
  try {
    res.json({
      success: true,
      faculty: timetableRepository.faculty,
      rooms: timetableRepository.rooms,
      sections: timetableRepository.sections,
      subjects: timetableRepository.subjects,
      timeSlots: timetableRepository.timeSlots,
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
