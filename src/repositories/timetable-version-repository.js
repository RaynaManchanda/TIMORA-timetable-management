import { VERSION_STATUS } from '../constants/statuses.js';

/**
 * Convert a timetable_versions row into an application object.
 *
 * @param {object} row Prisma version.
 * @returns {object}
 */
export function toVersion(row) {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    name: row.name,
    status: row.status,
    parentVersionId: row.parentVersionId,
    disruptionId: row.disruptionId,
    approvedBy: row.approvedBy,
    changeLog: row.changeLog,
    qualityScore: row.qualityScore === undefined ? undefined : Number(row.qualityScore),
    createdAt: row.createdAt
  };
}

/**
 * Data access for timetable versions.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db Prisma client or transaction.
 */
export function createTimetableVersionRepository(db) {
  return {
    /**
     * Get the currently ACTIVE version.
     *
     * @returns {Promise<object | null>}
     */
    async findActive() {
      const row = await db.timetableVersion.findFirst({ where: { status: VERSION_STATUS.ACTIVE } });
      return row ? toVersion(row) : null;
    },

    /**
     * Find a version by id.
     *
     * @param {string} id Version id.
     * @returns {Promise<object | null>}
     */
    async findById(id) {
      const row = await db.timetableVersion.findUnique({ where: { id } });
      return row ? toVersion(row) : null;
    },

    /**
     * List all versions, newest first.
     *
     * @returns {Promise<object[]>}
     */
    async findAll() {
      const rows = await db.timetableVersion.findMany({ orderBy: [{ createdAt: 'desc' }, { versionNumber: 'desc' }] });
      return rows.map(toVersion);
    },

    /**
     * Count the stored versions. Used to derive the next version number.
     *
     * @returns {Promise<number>}
     */
    count() {
      return db.timetableVersion.count();
    },

    /**
     * Mark every ACTIVE version as ARCHIVED.
     *
     * @returns {Promise<void>}
     */
    async archiveActive() {
      await db.timetableVersion.updateMany({
        where: { status: VERSION_STATUS.ACTIVE },
        data: { status: VERSION_STATUS.ARCHIVED }
      });
    },

    /**
     * Make an existing version the ACTIVE one (rollback). Run inside a transaction.
     *
     * @param {string} id Version id.
     * @returns {Promise<object>} The activated version.
     */
    async activate(id) {
      await this.archiveActive();
      return toVersion(await db.timetableVersion.update({ where: { id }, data: { status: VERSION_STATUS.ACTIVE } }));
    },

    /**
     * Insert a new ACTIVE version.
     *
     * @param {object} version Version fields.
     * @returns {Promise<object>} The stored version.
     */
    async createActive(version) {
      const row = await db.timetableVersion.create({
        data: {
          id: version.id,
          versionNumber: version.versionNumber,
          name: version.name,
          status: VERSION_STATUS.ACTIVE,
          parentVersionId: version.parentVersionId || null,
          disruptionId: version.disruptionId || null,
          approvedBy: version.approvedBy,
          changeLog: version.changeLog || null,
          qualityScore: version.qualityScore ?? 0
        }
      });
      return toVersion(row);
    }
  };
}
