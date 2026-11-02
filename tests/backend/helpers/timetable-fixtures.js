/**
 * Insert a section used by the timetable test cases.
 *
 * @param {import('pg').Pool} pool Test database pool.
 * @param {string} [id] Section id.
 * @returns {Promise<void>}
 */
export async function insertSection(pool, id = 'CSE5') {
  await pool.query(
    `INSERT INTO sections (id, name, program, semester, student_count)
     VALUES ($1, $2, 'B.Tech CSE', 5, 64) ON CONFLICT (id) DO NOTHING`,
    [id, `Section ${id}`]
  );
}

/**
 * Build a valid timetable entry request body with sensible defaults.
 *
 * @param {object} [overrides] Fields replacing the defaults.
 * @returns {object}
 */
export function buildEntryBody(overrides = {}) {
  return {
    sectionId: 'CSE5',
    subjectId: 'SUB_CS501',
    facultyId: 'F101',
    roomId: 'R204',
    day: 'TUESDAY',
    slot: 'S2',
    ...overrides
  };
}

/**
 * Build many non-conflicting entries for one section.
 * Each entry uses a different day and slot, so none can clash with another.
 *
 * @param {number} count Number of entries (maximum 42: six days times seven slots).
 * @param {string} [sectionId] Section the entries belong to.
 * @returns {object[]}
 */
export function buildConflictFreeEntries(count, sectionId = 'CSE5') {
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const slots = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'];

  return Array.from({ length: count }, (_, index) =>
    buildEntryBody({
      sectionId,
      day: days[index % days.length],
      slot: slots[Math.floor(index / days.length) % slots.length]
    })
  );
}
