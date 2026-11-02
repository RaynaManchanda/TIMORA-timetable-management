import { DISRUPTION_STATUS } from '../constants/statuses.js';

/**
 * Convert a disruptions row into the object used by the impact analyser and the frontend.
 *
 * @param {object} row Prisma disruption.
 * @returns {object}
 */
function toDisruption(row) {
  return {
    id: row.id,
    disruptionType: row.disruptionType,
    type: row.disruptionType,
    affectedEntityType: row.affectedEntityType,
    affectedEntityId: row.affectedEntityId,
    affectedEntityName: row.affectedEntityName,
    dayOfWeek: row.dayOfWeek,
    date: row.date,
    slotId: row.slotId,
    reason: row.reason,
    reportedBy: row.reportedBy,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt
  };
}

/**
 * Data access for disruptions and the approval audit trail.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db Prisma client or transaction.
 */
export function createDisruptionRepository(db) {
  return {
    /**
     * Store a validated disruption.
     *
     * @param {object} disruption Disruption fields.
     * @returns {Promise<object>}
     */
    async create(disruption) {
      const row = await db.disruption.create({
        data: {
          id: disruption.id,
          disruptionType: disruption.disruptionType,
          affectedEntityType: disruption.affectedEntityType,
          affectedEntityId: disruption.affectedEntityId,
          affectedEntityName: disruption.affectedEntityName ?? null,
          dayOfWeek: disruption.dayOfWeek,
          date: disruption.date ?? null,
          slotId: disruption.slotId ?? null,
          reason: disruption.reason,
          reportedBy: disruption.reportedBy ?? null,
          status: disruption.status ?? DISRUPTION_STATUS.RECORDED
        }
      });
      return toDisruption(row);
    },

    /**
     * @param {string} id Disruption id.
     * @returns {Promise<object | null>}
     */
    async findById(id) {
      const row = await db.disruption.findUnique({ where: { id } });
      return row ? toDisruption(row) : null;
    },

    /**
     * List disruptions, newest first.
     *
     * @returns {Promise<object[]>}
     */
    async findAll() {
      const rows = await db.disruption.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map(toDisruption);
    },

    /**
     * Move a disruption to a new status.
     *
     * @param {string} id Disruption id.
     * @param {string} status New status.
     * @returns {Promise<object>}
     */
    async updateStatus(id, status) {
      const row = await db.disruption.update({
        where: { id },
        data: { status, resolvedAt: status === DISRUPTION_STATUS.RESOLVED ? new Date() : null }
      });
      return toDisruption(row);
    },

    /**
     * Record that a human approved an alternative.
     *
     * @param {{ id: string, disruptionId: string, alternativeId: string, approvedVersionId: string, approvedBy: string, notes?: string }} log Audit record.
     * @returns {Promise<object>}
     */
    async createApprovalLog(log) {
      return db.approvalLog.create({ data: { ...log, notes: log.notes || null } });
    },

    /**
     * List the approval audit trail, newest first.
     *
     * @returns {Promise<object[]>}
     */
    findApprovalLogs() {
      return db.approvalLog.findMany({ orderBy: { approvedAt: 'desc' } });
    }
  };
}
