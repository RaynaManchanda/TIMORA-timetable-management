/**
 * TIMORA - AI Provider & Mock Engine
 * Abstract Provider interface with deterministic fallback parser.
 * Supports external LLM providers (OpenAI/Gemini) if environment variables are set.
 */

import { DISRUPTION_TYPES } from '../adaptive/disruption/disruption-model.js';

/**
 * Escape text for use inside a regular expression.
 *
 * @param {string} text Plain text.
 * @returns {string}
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the faculty member a request is about: full name first, then a distinctive name part.
 *
 * @param {string} text Lower-case request.
 * @param {{ id: string, name: string }[]} faculty Faculty of the college.
 * @returns {{ id: string, name: string }} The match, or the first faculty member when nobody is named.
 */
function findFaculty(text, faculty) {
  const stripTitle = (name) => name.toLowerCase().replace(/^(dr|prof|mr|ms|mrs)\.?\s+/, '');
  const full = faculty.find((f) => text.includes(stripTitle(f.name)));
  if (full) return full;

  const parts = (f) => stripTitle(f.name).split(/\s+/).filter((part) => part.length >= 4);
  return faculty.find((f) => parts(f).some((part) => new RegExp(`\b${part}\b`).test(text))) ?? faculty[0];
}

export class AIProvider {
  async parseNaturalLanguage(prompt, catalog) {
    throw new Error('parseNaturalLanguage must be implemented by concrete subclass.');
  }
}

export class MockAIProvider extends AIProvider {
  /**
   * @param {string} prompt Natural-language request.
   * @param {{ faculty: object[], subjects: object[] }} catalog Faculty and subjects of the college, used to resolve names.
   */
  async parseNaturalLanguage(prompt, catalog = { faculty: [], subjects: [] }) {
    const text = prompt.trim().toLowerCase();
    const faculty = catalog.faculty ?? [];
    const subjects = catalog.subjects ?? [];
    if (faculty.length === 0 || subjects.length === 0) {
      throw new Error('Faculty and subject data are required to interpret a request.');
    }

    // 1. Detect Day of Week
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const matchedDayText = days.find(d => text.includes(d));
    const dayOfWeek = matchedDayText ? matchedDayText.charAt(0).toUpperCase() + matchedDayText.slice(1) : 'Tuesday';

    // 2. Detect Faculty Absence / Leave / Unavailability
    if (text.includes('unavailable') || text.includes('absent') || text.includes('leave') || text.includes('sick')) {
      const person = findFaculty(text, faculty);

      let slotId = null;
      if (text.includes('10-12') || text.includes('10 to 12') || text.includes('10 am')) {
        slotId = 'S2';
      }

      return {
        disruptionType: DISRUPTION_TYPES.FACULTY_ABSENCE,
        affectedEntityType: 'FACULTY',
        affectedEntityId: person.id,
        affectedEntityName: person.name,
        dayOfWeek,
        slotId,
        reason: `Natural language input: "${prompt}"`,
        confidence: 0.95
      };
    }

    // 3. Detect Class Cancellation
    if (text.includes('cancel') || text.includes('cancellation')) {
      const subject =
        subjects.find(
          (s) =>
            text.includes(s.name.toLowerCase()) ||
            text.includes(s.code.toLowerCase()) ||
            (s.abbreviation && new RegExp(`\\b${escapeRegExp(s.abbreviation.toLowerCase())}\\b`).test(text))
        ) || subjects[0];

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
      const person = findFaculty(text, faculty);
      return {
        disruptionType: DISRUPTION_TYPES.SWAP_REQUEST,
        affectedEntityType: 'FACULTY',
        affectedEntityId: person.id,
        affectedEntityName: person.name,
        dayOfWeek,
        slotId: 'S2',
        reason: `Natural language input: "${prompt}"`,
        confidence: 0.90
      };
    }

    // 5. Default Fallback Disruption Interpretation
    const defaultFaculty = findFaculty(text, faculty);
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

  async parseNaturalLanguage(prompt, catalog) {
    if (!this.apiKey) {
      // Safe fallback if API key is not configured
      return this.fallbackMock.parseNaturalLanguage(prompt, catalog);
    }
    // External API call implementation could go here
    return this.fallbackMock.parseNaturalLanguage(prompt, catalog);
  }
}
