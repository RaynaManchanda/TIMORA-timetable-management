import { ConflictError, NotFoundError } from '../errors/app-errors.js';
import { isForeignKeyViolation, isRecordNotFound, isUniqueViolation } from '../db/database-errors.js';

/**
 * Run a create that may violate a unique constraint and report it as a 409.
 *
 * @param {() => Promise<object>} create Prisma call.
 * @param {string} message Message for the conflict.
 * @returns {Promise<object>}
 */
async function createOrConflict(create, message) {
  try {
    return await create();
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError(message);
    throw error;
  }
}

/**
 * Run a delete and report a missing record as a 404.
 *
 * @param {() => Promise<object>} remove Prisma call.
 * @param {string} message Message for the missing record.
 * @returns {Promise<object>}
 */
async function deleteOrNotFound(remove, message) {
  try {
    return await remove();
  } catch (error) {
    if (isRecordNotFound(error)) throw new NotFoundError(message);
    if (isForeignKeyViolation(error)) {
      throw new ConflictError('This record is still used by timetable entries and cannot be deleted.');
    }
    throw error;
  }
}

/** Public shape of a subject. */
const toSubject = (row) => ({ ...row, createdAt: undefined, requiredHoursPerWeek: row.requiredHoursPerWeek });
/** Public shape of a section. */
const toSection = (row) => ({ id: row.id, name: row.name, program: row.program, semester: row.semester, studentCount: row.studentCount, batch: row.batch });
/** Public shape of a faculty member. */
const toFaculty = (row) => ({ id: row.id, name: row.name, email: row.email, department: row.department, maxHoursPerWeek: row.maxHoursPerWeek, isActive: row.isActive });
/** Public shape of a room. */
const toRoom = (row) => ({ id: row.id, name: row.name, building: row.building, capacity: row.capacity, type: row.type, isShared: row.isShared, isActive: row.isActive });

/**
 * Data access for the academic reference data: sections, faculty, rooms, subjects, time slots and blocks.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db Prisma client or transaction.
 */
export function createAcademicRepository(db) {
  return {
    async listSections() {
      return (await db.section.findMany({ orderBy: [{ batch: 'asc' }, { id: 'asc' }] })).map(toSection);
    },
    async listFaculty() {
      return (await db.faculty.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })).map(toFaculty);
    },
    async listRooms() {
      return (await db.room.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })).map(toRoom);
    },
    async listSubjects() {
      return (await db.subject.findMany({ orderBy: { code: 'asc' } })).map(toSubject);
    },
    async listTimeSlots() {
      return (await db.timeSlot.findMany({ orderBy: { slotNumber: 'asc' } })).map((slot) => ({ ...slot, isLunchBreak: false }));
    },

    /**
     * Reserved blocks (lunch, mentoring, minor ...) of the sections.
     *
     * @param {{ sectionId?: string }} [filters] Optional section filter.
     * @returns {Promise<object[]>}
     */
    async listBlocks({ sectionId } = {}) {
      const rows = await db.sectionBlock.findMany({
        where: sectionId ? { sectionId } : {},
        orderBy: [{ sectionId: 'asc' }, { day: 'asc' }, { slot: { slotNumber: 'asc' } }]
      });
      return rows.map((row) => ({ id: row.id, sectionId: row.sectionId, day: row.day, slotId: row.slotId, kind: row.kind, label: row.label }));
    },

    createSection(section) {
      return createOrConflict(async () => toSection(await db.section.create({ data: section })), `Section ${section.id} already exists.`);
    },
    createFaculty(faculty) {
      return createOrConflict(async () => toFaculty(await db.faculty.create({ data: faculty })), 'A faculty member with this id or email already exists.');
    },
    createRoom(room) {
      return createOrConflict(async () => toRoom(await db.room.create({ data: room })), `Room ${room.id} already exists.`);
    },
    createSubject(subject) {
      return createOrConflict(async () => toSubject(await db.subject.create({ data: subject })), 'A subject with this id or code already exists.');
    },

    deleteSection(id) {
      return deleteOrNotFound(async () => toSection(await db.section.delete({ where: { id } })), 'Section not found.');
    },
    deleteFaculty(id) {
      return deleteOrNotFound(async () => toFaculty(await db.faculty.delete({ where: { id } })), 'Faculty not found.');
    },
    deleteRoom(id) {
      return deleteOrNotFound(async () => toRoom(await db.room.delete({ where: { id } })), 'Room not found.');
    },
    deleteSubject(id) {
      return deleteOrNotFound(async () => toSubject(await db.subject.delete({ where: { id } })), 'Subject not found.');
    }
  };
}
