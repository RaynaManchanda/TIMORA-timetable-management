import { randomUUID } from 'node:crypto';

/**
 * Create a unique identifier with a readable prefix, e.g. "USR_3f2a...".
 *
 * @param {string} prefix Short upper-case prefix describing the record type.
 * @returns {string}
 */
export function generateId(prefix) {
  return `${prefix}_${randomUUID()}`;
}
