/**
 * Small, fictional academic data set used by the tests.
 * It is deliberately not the college data: tests stay independent of what the administrator imports.
 */

export const SEED_FACULTY = [
  { id: 'F101', name: 'Dr. Alan Turing', email: 'turing@univ.edu', department: 'Computer Science', maxHoursPerWeek: 18 },
  { id: 'F102', name: 'Prof. Grace Hopper', email: 'hopper@univ.edu', department: 'Computer Science', maxHoursPerWeek: 18 },
  { id: 'F103', name: 'Dr. Ada Lovelace', email: 'lovelace@univ.edu', department: 'Mathematics', maxHoursPerWeek: 15 },
  { id: 'F104', name: 'Prof. Claude Shannon', email: 'shannon@univ.edu', department: 'Electronics', maxHoursPerWeek: 16 }
];

export const SEED_ROOMS = [
  { id: 'R201', name: 'Lab 1', building: 'Tech Block', capacity: 60, type: 'LAB' },
  { id: 'R202', name: 'Hall A', building: 'Tech Block', capacity: 80, type: 'CLASSROOM' },
  { id: 'R203', name: 'Room 301', building: 'Academic Block', capacity: 60, type: 'CLASSROOM' },
  { id: 'R204', name: 'Room 302', building: 'Academic Block', capacity: 60, type: 'CLASSROOM' }
];

export const SEED_SECTIONS = [
  { id: 'SEC_CSE_5A', name: 'CSE 5th Sem - Sec A', program: 'B.Tech CSE', semester: 5, studentCount: 55 },
  { id: 'SEC_CSE_5B', name: 'CSE 5th Sem - Sec B', program: 'B.Tech CSE', semester: 5, studentCount: 50 },
  { id: 'SEC_ECE_5A', name: 'ECE 5th Sem - Sec A', program: 'B.Tech ECE', semester: 5, studentCount: 45 }
];

export const SEED_SUBJECTS = [
  { id: 'SUB_CS501', code: 'CS501', name: 'Database Management Systems', type: 'LECTURE', requiredHoursPerWeek: 3 },
  { id: 'SUB_CS502', code: 'CS502', name: 'DBMS Lab', type: 'LAB', requiredHoursPerWeek: 2 },
  { id: 'SUB_CS503', code: 'CS503', name: 'Operating Systems', type: 'LECTURE', requiredHoursPerWeek: 3 },
  { id: 'SUB_MA501', code: 'MA501', name: 'Discrete Mathematics', type: 'LECTURE', requiredHoursPerWeek: 3 },
  { id: 'SUB_EC501', code: 'EC501', name: 'Digital Signal Processing', type: 'LECTURE', requiredHoursPerWeek: 3 }
];

/** Timetable in the shape used by the scheduling and rescheduling modules. */
export const INITIAL_TIMETABLE_ENTRIES = [
  { id: 'E1001', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS501', facultyId: 'F101', roomId: 'R202', dayOfWeek: 'Tuesday', slotId: 'S2' },
  { id: 'E1002', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS502', facultyId: 'F101', roomId: 'R201', dayOfWeek: 'Tuesday', slotId: 'S3' },
  { id: 'E1003', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS503', facultyId: 'F102', roomId: 'R202', dayOfWeek: 'Tuesday', slotId: 'S5' },
  { id: 'E1004', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_MA501', facultyId: 'F103', roomId: 'R203', dayOfWeek: 'Tuesday', slotId: 'S6' },
  { id: 'E1005', sectionId: 'SEC_CSE_5B', subjectId: 'SUB_CS501', facultyId: 'F101', roomId: 'R204', dayOfWeek: 'Wednesday', slotId: 'S1' },
  { id: 'E1006', sectionId: 'SEC_CSE_5B', subjectId: 'SUB_CS503', facultyId: 'F102', roomId: 'R202', dayOfWeek: 'Wednesday', slotId: 'S2' },
  { id: 'E1007', sectionId: 'SEC_ECE_5A', subjectId: 'SUB_EC501', facultyId: 'F104', roomId: 'R203', dayOfWeek: 'Wednesday', slotId: 'S3' },
  { id: 'E1008', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS501', facultyId: 'F101', roomId: 'R202', dayOfWeek: 'Thursday', slotId: 'S1' },
  { id: 'E1009', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_CS503', facultyId: 'F102', roomId: 'R202', dayOfWeek: 'Thursday', slotId: 'S2' },
  { id: 'E1010', sectionId: 'SEC_CSE_5A', subjectId: 'SUB_MA501', facultyId: 'F103', roomId: 'R203', dayOfWeek: 'Thursday', slotId: 'S5' }
];

/** Reference-data context for the pure modules (rooms, faculty, subjects). */
export const FIXTURE_CONTEXT = Object.freeze({
  rooms: SEED_ROOMS,
  faculty: SEED_FACULTY,
  subjects: SEED_SUBJECTS,
  activeEntries: INITIAL_TIMETABLE_ENTRIES
});

/**
 * Store the fixture data and an empty ACTIVE version "VER_1.0".
 *
 * @param {import('@prisma/client').PrismaClient} prisma Prisma client connected to the test database.
 * @param {{ withEntries?: boolean }} [options] Also store the starter timetable entries.
 * @returns {Promise<void>}
 */
export async function seedFixtureData(prisma, { withEntries = false } = {}) {
  await prisma.section.createMany({ data: SEED_SECTIONS, skipDuplicates: true });
  await prisma.faculty.createMany({ data: SEED_FACULTY, skipDuplicates: true });
  await prisma.room.createMany({ data: SEED_ROOMS, skipDuplicates: true });
  await prisma.subject.createMany({ data: SEED_SUBJECTS, skipDuplicates: true });

  await prisma.timetableVersion.create({
    data: {
      id: 'VER_1.0',
      versionNumber: 'v1.0',
      name: 'Initial Master Timetable (Base)',
      status: 'ACTIVE',
      approvedBy: 'System Admin',
      changeLog: 'Base timetable loaded.'
    }
  });

  if (withEntries) {
    await prisma.timetableEntry.createMany({
      data: INITIAL_TIMETABLE_ENTRIES.map(({ dayOfWeek, ...entry }) => ({
        ...entry,
        versionId: 'VER_1.0',
        day: dayOfWeek.toUpperCase(),
        sessionType: entry.subjectId === 'SUB_CS502' ? 'LAB' : 'LECTURE'
      }))
    });
  }
}
