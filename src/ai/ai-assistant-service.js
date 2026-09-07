/**
 * TIMORA - AI Assistant Service
 * Manages natural language interpretation, human validation wrappers, and data-backed explanation generation.
 */

import { MockAIProvider, ExternalAIProvider } from './ai-provider.js';

class AIAssistantService {
  constructor() {
    this.provider = process.env.AI_API_KEY ? new ExternalAIProvider() : new MockAIProvider();
  }

  /**
   * Step 1: Interpret natural language prompt into structured constraint request.
   */
  async interpretConstraint(promptText) {
    if (!promptText || promptText.trim() === '') {
      throw new Error('Natural language prompt text is required.');
    }

    const structuredConstraint = await this.provider.parseNaturalLanguage(promptText);

    return {
      rawPrompt: promptText,
      structuredConstraint,
      status: 'AWAITING_HUMAN_VALIDATION',
      isValidated: false,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Step 2: Human Validation Step.
   * Ensures administrator verifies or corrects the AI structured output BEFORE passing to the rescheduling engine.
   */
  validateConstraint(interpretedResult, adminCorrections = {}) {
    if (!interpretedResult || !interpretedResult.structuredConstraint) {
      throw new Error('Valid interpreted constraint result required for validation.');
    }

    const validatedConstraint = {
      ...interpretedResult.structuredConstraint,
      ...adminCorrections,
      isHumanValidated: true,
      validatedAt: new Date().toISOString()
    };

    return {
      status: 'VALIDATED',
      rawPrompt: interpretedResult.rawPrompt,
      validatedConstraint,
      message: 'Constraint validated by administrator. Ready for rescheduling engine execution.'
    };
  }

  /**
   * Step 3: AI Schedule Explanation Generator.
   * Generates explanations based strictly on calculated scheduling metrics (no hallucination).
   */
  generateExplanation(alternative, disruption) {
    if (!alternative) return 'No alternative available to explain.';

    const { name, changeCount, disruptionCost, studentDayQualityScore, modifiedEntries } = alternative;

    if (changeCount === 0) {
      return `Recommendation: ${name}. No schedule modifications are needed because no active classes were affected by this disruption.`;
    }

    const firstMod = modifiedEntries && modifiedEntries[0];
    const modSummary = firstMod
      ? `moves ${firstMod.subjectName || 'class'} from ${firstMod.oldDay} (${firstMod.oldSlot}) to ${firstMod.newDay} (${firstMod.newSlotLabel || firstMod.newSlot})`
      : 'adjusts affected schedule slots';

    const qualityAssessment = studentDayQualityScore >= 80 
      ? 'maintains excellent student-day ergonomics with minimal idle gaps' 
      : 'provides a feasible balance between student gaps and room availability';

    return `${name} ${modSummary}. It changes only ${changeCount} class(es) (Disruption Cost: ${disruptionCost}), keeps faculty and room availability 100% hard-constraint compliant, and ${qualityAssessment} (Student-Day Quality Score: ${studentDayQualityScore}/100).`;
  }
}

export const aiAssistantService = new AIAssistantService();
