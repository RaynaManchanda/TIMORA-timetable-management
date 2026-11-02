import { describe, expect, test } from '@jest/globals';
import { validateLogin, validateRegistration } from '../../../src/validation/auth-validator.js';
import {
  validateEntryPayload,
  validateTimetableQuery
} from '../../../src/validation/timetable-validator.js';
import { ValidationError } from '../../../src/errors/app-errors.js';

describe('auth validator', () => {
  const validBody = { name: ' Asha ', email: ' asha@timora.edu ', password: 'Str0ngPassw0rd!' };

  test('trims input and defaults the role to STUDENT', () => {
    expect(validateRegistration(validBody)).toMatchObject({ name: 'Asha', email: 'asha@timora.edu', role: 'STUDENT' });
  });

  test('collects every problem instead of stopping at the first', () => {
    expect.assertions(2);
    try {
      validateRegistration({ name: '', email: 'not-an-email', password: 'x', role: 'WIZARD' });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.details.validationErrors.length).toBeGreaterThanOrEqual(4);
    }
  });

  test('login only requires an email and a password', () => {
    expect(validateLogin({ email: "a' OR '1'='1", password: 'x' })).toEqual({ email: "a' OR '1'='1", password: 'x' });
    expect(() => validateLogin({})).toThrow(ValidationError);
  });
});

describe('timetable validator', () => {
  const validEntry = { sectionId: 'CSE5', subjectId: 'SUB_CS501', facultyId: 'F101', roomId: 'R204', day: 'tuesday', slot: 's2' };

  test('normalises day and slot to upper case and defaults the session type', () => {
    expect(validateEntryPayload(validEntry)).toMatchObject({ day: 'TUESDAY', slot: 'S2', sessionType: 'LECTURE' });
  });

  test('reports each missing required field by name', () => {
    expect.assertions(1);
    try {
      validateEntryPayload({});
    } catch (error) {
      expect(error.details.validationErrors).toEqual([
        'sectionId is required',
        'subjectId is required',
        'facultyId is required',
        'roomId is required',
        'day is required',
        'slot is required'
      ]);
    }
  });

  test('accepts a plain section query and normalises the day', () => {
    expect(validateTimetableQuery({ section: 'CSE5', day: 'tuesday' })).toEqual({ sectionId: 'CSE5', day: 'TUESDAY' });
  });

  test.each([
    ["CSE5' OR '1'='1"],
    ['CSE5;DROP TABLE users'],
    ['../etc/passwd'],
    [['CSE5', 'CSE6']],
    [{ $ne: 'x' }]
  ])('rejects the unsafe section value %j', (section) => {
    expect(() => validateTimetableQuery({ section })).toThrow(ValidationError);
  });
});
