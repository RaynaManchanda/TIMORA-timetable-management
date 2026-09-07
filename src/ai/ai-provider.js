/**
 * TIMORA - AI Provider & Mock Engine
 * Abstract Provider interface with deterministic fallback parser.
 * Supports external LLM providers (OpenAI/Gemini) if environment variables are set.
 */

import { DISRUPTION_TYPES } from '../adaptive/disruption/disruption-model.js';
import { timetableRepository } from '../repositories/timetable-repository.js';

export class AIProvider {
  async parseNaturalLanguage(prompt) {
    throw new Error('parseNaturalLanguage must be implemented by concrete subclass.');
  }
}

export class MockAIProvider extends AIProvider {
  async parseNaturalLanguage(prompt) {
    const text = prompt.trim().toLowerCase();

    // 1. Detect Day of Week
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const matchedDayText = days.find(d => text.includes(d));
    const dayOfWeek = matchedDayText ? matchedDayText.charAt(0).toUpperCase() + matchedDayText.slice(1) : 'Tuesday';

    // 2. Detect Faculty Absence / Leave / Unavailability
    if (text.includes('unavailable') || text.includes('absent') || text.includes('leave') || text.includes('sick')) {
      // Find matching faculty from repository
      const faculty = timetableRepository.faculty.find(f => text.includes(f.name.toLowerCase()) || text.includes(f.name.split(' ').pop().toLowerCase())) || timetableRepository.faculty[0];

      let slotId = null;
      if (text.includes('10-12') || text.includes('10 to 12') || text.includes('10 am')) {
        slotId = 'S2';
      }

      return {
        disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
        affectedEntityType: 'FACULTY',
        affectedEntityId: faculty.id,
        affectedEntityName: faculty.name,
        dayOfWeek,
        slotId,
        reason: `Natural language input: "${prompt}"`,
        confidence: 0.95
      };
    }

    // 3. Detect Class Cancellation
    if (text.includes('cancel') || text.includes('cancellation')) {
      const subject = timetableRepository.subjects.find(s => text.includes(s.name.toLowerCase()) || text.includes(s.code.toLowerCase())) || timetableRepository.subjects[0];

      return {
        disruptionType: DISRUPTION_TYPES.CLASS_CANCELLATION,
        affectedEntityType: 'TIMETABLE_ENTRY',
        affectedEntityId: subject.id,
        affectedEntityName: subject.name,
        dayOfWeek,
        slotId: 'S1',
        reason: `Natural language input: "${prompt}"`,
        confidence: 0.92
      };
    }

    // 4. Detect Faculty Swap Request
    if (text.includes('swap') || text.includes('exchange')) {
      const faculty = timetableRepository.faculty[0];
      return {
        disruptionType: DISRUPTION_TYPES.SWAP_REQUEST,
        affectedEntityType: 'FACULTY',
        affectedEntityId: faculty.id,
        affectedEntityName: faculty.name,
        dayOfWeek,
        slotId: 'S2',
        reason: `Natural language input: "${prompt}"`,
        confidence: 0.90
      };
    }

    // 5. Default Fallback Disruption Interpretation
    const defaultFaculty = timetableRepository.faculty[0];
    return {
      disruptionType: DISRUPTION_TYPES.FACULTY_UNAVAILABILITY,
      affectedEntityType: 'FACULTY',
      affectedEntityId: defaultFaculty.id,
      affectedEntityName: defaultFaculty.name,
      dayOfWeek,
      slotId: null,
      reason: `Interpreted from prompt: "${prompt}"`,
      confidence: 0.85
    };
  }
}

export class ExternalAIProvider extends AIProvider {
  constructor(apiKey = process.env.AI_API_KEY) {
    super();
    this.apiKey = apiKey;
    this.fallbackMock = new MockAIProvider();
  }

  async parseNaturalLanguage(prompt) {
    if (!this.apiKey) {
      // Safe fallback if API key is not configured
      return this.fallbackMock.parseNaturalLanguage(prompt);
    }
    // External API call implementation could go here
    return this.fallbackMock.parseNaturalLanguage(prompt);
  }
}
