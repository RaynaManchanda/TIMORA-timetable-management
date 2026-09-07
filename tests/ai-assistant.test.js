import test from 'node:test';
import assert from 'node:assert/strict';
import { aiAssistantService } from '../src/ai/ai-assistant-service.js';

test('AI Assistant - Interpret Natural Language Input', async () => {
  const result = await aiAssistantService.interpretConstraint('Prof Turing is unavailable on Tuesday 10-12');

  assert.equal(result.status, 'AWAITING_HUMAN_VALIDATION');
  assert.equal(result.isValidated, false);
  assert.ok(result.structuredConstraint);
  assert.ok(result.structuredConstraint.disruptionType);
  assert.equal(result.structuredConstraint.dayOfWeek, 'Tuesday');
});

test('AI Assistant - Human Validation Step Wrapper', async () => {
  const interpreted = await aiAssistantService.interpretConstraint('Cancel Database class on Wednesday');
  const validated = aiAssistantService.validateConstraint(interpreted, { reason: 'Verified by Admin' });

  assert.equal(validated.status, 'VALIDATED');
  assert.equal(validated.validatedConstraint.isHumanValidated, true);
  assert.equal(validated.validatedConstraint.reason, 'Verified by Admin');
});

test('AI Assistant - Data-Backed Explanation Generator (No Hallucination)', () => {
  const sampleAlt = {
    name: 'Option 1: Relocate to Tuesday S5',
    changeCount: 1,
    disruptionCost: 1,
    studentDayQualityScore: 92,
    modifiedEntries: [
      { subjectName: 'Database Systems', oldDay: 'Tuesday', oldSlot: 'S2', newDay: 'Tuesday', newSlot: 'S5', newSlotLabel: '13:00 - 14:00' }
    ]
  };

  const explanation = aiAssistantService.generateExplanation(sampleAlt, { id: 'DIS1' });
  assert.ok(explanation.includes('Option 1: Relocate to Tuesday S5'));
  assert.ok(explanation.includes('Database Systems'));
  assert.ok(explanation.includes('100% hard-constraint compliant'));
  assert.ok(explanation.includes('92/100'));
});
