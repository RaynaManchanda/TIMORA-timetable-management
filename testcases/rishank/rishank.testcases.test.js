/**
 * TIMORA - Scheduling Engine Tests
 * Person 1: Rishank Mishra (Core Scheduling & Optimization)
 * Tests TC01, TC02, TC03, TC04 from the consolidated test document.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedulingEngine } from '../../src/scheduling/scheduling-engine.js';
import { constraintModel } from '../../src/scheduling/constraint-model.js';

// Test Dataset matching Rishank's document:
// 4 subjects, 3 faculty members, 4 rooms, 2 sections
const sampleFaculty = [
  { id: 'F1', name: 'Dr. Turing', department: 'CSE', maxHoursPerWeek: 18 },
  { id: 'F2', name: 'Prof. Hopper', department: 'CSE', maxHoursPerWeek: 18 },
  { id: 'F3', name: 'Dr. Lovelace', department: 'CSE', maxHoursPerWeek: 18 }
];

const sampleRooms = [
  { id: 'R1', name: 'Lab 101', capacity: 70, type: 'LAB' },
  { id: 'R2', name: 'Room 201', capacity: 70, type: 'CLASSROOM' },
  { id: 'R3', name: 'Room 202', capacity: 70, type: 'CLASSROOM' },
  { id: 'R4', name: 'Hall A', capacity: 80, type: 'CLASSROOM' }
];

const sampleSections = [
  { id: 'CSE-3A', name: 'CSE-3A', studentCount: 50 },
  { id: 'CSE-3B', name: 'CSE-3B', studentCount: 50 }
];

// 4 subjects with credit-based session requirements totaling 12 sessions:
// CS301 (2 lec, 1 tut = 3)
// CS302 (2 lec, 1 lab = 3)
// CS303 (2 lec, 1 tut = 3)
// CS304 (2 lec, 1 lab = 3)
// Total: 12 sessions
const sampleSubjects12 = [
  {
    id: 'CS301',
    code: 'CS301',
    name: 'Data Structures',
    type: 'LECTURE',
    facultyId: 'F1',
    breakdown: { lectures: 2, tutorials: 1, labs: 0 }
  },
  {
    id: 'CS302',
    code: 'CS302',
    name: 'Operating Systems',
    type: 'LECTURE',
    facultyId: 'F2',
    breakdown: { lectures: 2, tutorials: 0, labs: 1 }
  },
  {
    id: 'CS303',
    code: 'CS303',
    name: 'Database Systems',
    type: 'LECTURE',
    facultyId: 'F3',
    breakdown: { lectures: 2, tutorials: 1, labs: 0 }
  },
  {
    id: 'CS304',
    code: 'CS304',
    name: 'Computer Networks',
    type: 'LECTURE',
    facultyId: 'F1',
    breakdown: { lectures: 2, tutorials: 0, labs: 1 }
  }
];

// Subjects with 4 sessions each (3 lec, 1 tut/lab)
const sampleSubjects16 = [
  {
    id: 'CS301',
    code: 'CS301',
    name: 'Data Structures',
    type: 'LECTURE',
    facultyId: 'F1',
    breakdown: { lectures: 3, tutorials: 1, labs: 0 }
  },
  {
    id: 'CS302',
    code: 'CS302',
    name: 'Operating Systems',
    type: 'LECTURE',
    facultyId: 'F2',
    breakdown: { lectures: 3, tutorials: 0, labs: 1 }
  },
  {
    id: 'CS303',
    code: 'CS303',
    name: 'Database Systems',
    type: 'LECTURE',
    facultyId: 'F3',
    breakdown: { lectures: 3, tutorials: 1, labs: 0 }
  },
  {
    id: 'CS304',
    code: 'CS304',
    name: 'Computer Networks',
    type: 'LECTURE',
    facultyId: 'F1',
    breakdown: { lectures: 3, tutorials: 0, labs: 1 }
  }
];

test('TC01 - Generate a feasible timetable with valid constraints', () => {
  // Test scenario: 4 subjects, 3 faculty members, 4 rooms, sections, with 12 required sessions
  const result = schedulingEngine.generateTimetable({
    subjects: sampleSubjects12,
    faculty: sampleFaculty,
    rooms: sampleRooms,
    sections: [sampleSections[0]]
  });

  assert.strictEqual(result.status, 'OPTIMAL');
  assert.strictEqual(result.scheduledSessionsCount, 12);
  assert.strictEqual(result.conflicts.length, 0);
  // Deterministic for this data set. The value depends on the college day layout (nine hourly slots,
  // lunch taken inside the S4-S6 window), so it changes if that layout does.
  assert.strictEqual(result.qualityScore, 1002.5);

  // Post-solve verification of hard constraints
  const validation = constraintModel.validateFullTimetable(result.entries, {
    rooms: sampleRooms,
    faculty: sampleFaculty,
    sections: [sampleSections[0]],
    subjects: sampleSubjects12
  });
  assert.strictEqual(validation.isValid, true);
  assert.strictEqual(validation.conflictCount, 0);
});

test('TC02 - Reject infeasible input (room capacity insufficient)', () => {
  // Section size (60 students) exceeds all available room capacities (all rooms set to 40)
  const smallRooms = [
    { id: 'R1', name: 'Lab 101', capacity: 40, type: 'LAB' },
    { id: 'R2', name: 'Room 201', capacity: 40, type: 'CLASSROOM' },
    { id: 'R3', name: 'Room 202', capacity: 40, type: 'CLASSROOM' },
    { id: 'R4', name: 'Hall A', capacity: 40, type: 'CLASSROOM' }
  ];

  const largeSection = [
    { id: 'CSE-3A', name: 'CSE-3A', studentCount: 60 }
  ];

  const result = schedulingEngine.generateTimetable({
    subjects: sampleSubjects12,
    faculty: sampleFaculty,
    rooms: smallRooms,
    sections: largeSection
  });

  assert.strictEqual(result.status, 'INFEASIBLE');
  assert.ok(
    result.error.includes('No lecture/tutorial room with capacity >= 60 exists for CS301 (section CSE-3A).') ||
    result.error.includes('capacity >= 60'),
    `Expected room capacity error message, got: ${result.error}`
  );
});

test('TC03 - Prevent faculty double-booking', () => {
  // Attempt to schedule two sessions for same faculty (F1) on same day at same slot
  const currentEntries = [
    { id: 'E1', facultyId: 'F1', roomId: 'R2', sectionId: 'CSE-3A', dayOfWeek: 'Monday', slotId: 'S2' }
  ];

  // Try to place another session for F1 at Monday S2
  const check = constraintModel.validateCandidateAssignment({
    dayOfWeek: 'Monday',
    slotId: 'S2',
    facultyId: 'F1',
    roomId: 'R3',
    sectionId: 'CSE-3B',
    subjectId: 'CS301',
    currentEntries
  });

  assert.strictEqual(check.isValid, false);
  assert.strictEqual(check.constraint, 'FACULTY_NO_DOUBLE_BOOKING');
  assert.ok(check.conflict.includes('Faculty F1 already scheduled'));
});

test('TC04 - Verify all required sessions are scheduled', () => {
  // 1. Verify 12 required sessions scheduled exactly once
  const result12 = schedulingEngine.generateTimetable({
    subjects: sampleSubjects12,
    faculty: sampleFaculty,
    rooms: sampleRooms,
    sections: [sampleSections[0]]
  });

  assert.strictEqual(result12.status, 'OPTIMAL');
  assert.strictEqual(result12.entries.length, 12);

  // Check counts per session type for CS301 (2 lec, 1 tut)
  const cs301Lec = result12.entries.filter(e => e.subjectId === 'CS301' && e.sessionType === 'LECTURE');
  const cs301Tut = result12.entries.filter(e => e.subjectId === 'CS301' && e.sessionType === 'TUTORIAL');
  assert.strictEqual(cs301Lec.length, 2);
  assert.strictEqual(cs301Tut.length, 1);

  // Check counts per session type for CS302 (2 lec, 1 lab)
  const cs302Lec = result12.entries.filter(e => e.subjectId === 'CS302' && e.sessionType === 'LECTURE');
  const cs302Lab = result12.entries.filter(e => e.subjectId === 'CS302' && e.sessionType === 'LAB');
  assert.strictEqual(cs302Lec.length, 2);
  assert.strictEqual(cs302Lab.length, 1);

  // 2. Also verify scheduling with 3 lec + 1 tut/lab (16 sessions) schedules all 16 sessions conflict-free
  const result16 = schedulingEngine.generateTimetable({
    subjects: sampleSubjects16,
    faculty: sampleFaculty,
    rooms: sampleRooms,
    sections: [sampleSections[0]]
  });

  assert.strictEqual(result16.status, 'OPTIMAL');
  assert.strictEqual(result16.entries.length, 16);
  const cs301Lec16 = result16.entries.filter(e => e.subjectId === 'CS301' && e.sessionType === 'LECTURE');
  const cs301Tut16 = result16.entries.filter(e => e.subjectId === 'CS301' && e.sessionType === 'TUTORIAL');
  assert.strictEqual(cs301Lec16.length, 3);
  assert.strictEqual(cs301Tut16.length, 1);
});
