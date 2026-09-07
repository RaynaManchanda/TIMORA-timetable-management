/**
 * TIMORA - Timetable Repository (In-Memory Data Store)
 * Provides realistic seed data and CRUD operations for Timetables, Faculty, Rooms, Sections, and Versions.
 * Designed to be replaced with a database ORM repository once backend-api is implemented.
 */

export const SEED_FACULTY = [
  { id: 'F101', name: 'Dr. Alan Turing', email: 'turing@univ.edu', department: 'Computer Science', maxHoursPerWeek: 18 },
  { id: 'F102', name: 'Prof. Grace Hopper', email: 'hopper@univ.edu', department: 'Computer Science', maxHoursPerWeek: 18 },
  { id: 'F103', name: 'Dr. Ada Lovelace', email: 'lovelace@univ.edu', department: 'Mathematics', maxHoursPerWeek: 15 },
  { id: 'F104', name: 'Prof. Claude Shannon', email: 'shannon@univ.edu', department: 'Electronics', maxHoursPerWeek: 16 }
];

export const SEED_ROOMS = [
  { id: 'R201', name: 'Lab 1', building: 'Tech Block', capacity: 40, type: 'LAB' },
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

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TIME_SLOTS = [
  { id: 'S1', slotNumber: 1, startTime: '09:00', endTime: '10:00', label: '09:00 - 10:00' },
  { id: 'S2', slotNumber: 2, startTime: '10:00', endTime: '11:00', label: '10:00 - 11:00' },
  { id: 'S3', slotNumber: 3, startTime: '11:00', endTime: '12:00', label: '11:00 - 12:00' },
  { id: 'S4', slotNumber: 4, startTime: '12:00', endTime: '13:00', label: '12:00 - 13:00 (Lunch)', isLunchBreak: true },
  { id: 'S5', slotNumber: 5, startTime: '13:00', endTime: '14:00', label: '13:00 - 14:00' },
  { id: 'S6', slotNumber: 6, startTime: '14:00', endTime: '15:00', label: '14:00 - 15:00' },
  { id: 'S7', slotNumber: 7, startTime: '15:00', endTime: '16:00', label: '15:00 - 16:00' }
];

// Initial Base Timetable Entries for Version 1.0
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

class TimetableRepository {
  constructor() {
    this.faculty = [...SEED_FACULTY];
    this.rooms = [...SEED_ROOMS];
    this.sections = [...SEED_SECTIONS];
    this.subjects = [...SEED_SUBJECTS];
    this.timeSlots = [...TIME_SLOTS];

    // Initialize Timetable Version History
    this.versions = [
      {
        id: 'VER_1.0',
        versionNumber: 'v1.0',
        name: 'Initial Master Timetable (Base)',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        parentVersionId: null,
        disruptionId: null,
        approvedBy: 'System Admin',
        changeLog: 'Base timetable loaded.',
        entries: JSON.parse(JSON.stringify(INITIAL_TIMETABLE_ENTRIES))
      }
    ];

    this.activeVersionId = 'VER_1.0';
  }

  getActiveVersion() {
    return this.versions.find(v => v.id === this.activeVersionId) || this.versions[this.versions.length - 1];
  }

  getVersionById(id) {
    return this.versions.find(v => v.id === id);
  }

  getAllVersions() {
    return [...this.versions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createVersion(newVersionData) {
    // Mark previous active version as ARCHIVED
    const currentActive = this.getActiveVersion();
    if (currentActive) {
      currentActive.status = 'ARCHIVED';
    }

    const versionId = `VER_${(this.versions.length + 1).toFixed(1)}`;
    const versionNumber = `v1.${this.versions.length}`;

    const newVersion = {
      id: versionId,
      versionNumber: versionNumber,
      name: newVersionData.name || `Rescheduled Version (${newVersionData.disruptionId || 'Manual'})`,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      parentVersionId: currentActive ? currentActive.id : null,
      disruptionId: newVersionData.disruptionId || null,
      approvedBy: newVersionData.approvedBy || 'Admin',
      changeLog: newVersionData.changeLog || 'Applied adaptive rescheduling changes.',
      entries: JSON.parse(JSON.stringify(newVersionData.entries))
    };

    this.versions.push(newVersion);
    this.activeVersionId = newVersion.id;
    return newVersion;
  }

  rollbackToVersion(versionId) {
    const targetVersion = this.getVersionById(versionId);
    if (!targetVersion) {
      throw new Error(`Version with ID ${versionId} not found.`);
    }

    // Set all as archived, target as ACTIVE
    this.versions.forEach(v => {
      v.status = v.id === versionId ? 'ACTIVE' : 'ARCHIVED';
    });
    this.activeVersionId = versionId;

    return targetVersion;
  }

  getFacultyById(id) {
    return this.faculty.find(f => f.id === id);
  }

  getRoomById(id) {
    return this.rooms.find(r => r.id === id);
  }

  getSectionById(id) {
    return this.sections.find(s => s.id === id);
  }

  getSubjectById(id) {
    return this.subjects.find(s => s.id === id);
  }

  getTimeSlotById(id) {
    return this.timeSlots.find(ts => ts.id === id);
  }
}

export const timetableRepository = new TimetableRepository();
