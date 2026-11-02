import { NOTIFICATION_STATUS } from '../constants/statuses.js';

const INSERT_CHUNK_SIZE = 1000;

/**
 * Split a list into fixed-size chunks.
 *
 * @template T
 * @param {T[]} items Items to split.
 * @param {number} size Maximum chunk length.
 * @returns {T[][]}
 */
function chunk(items, size) {
  const chunks = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

/**
 * Data access for notifications.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db Prisma client or transaction.
 */
export function createNotificationRepository(db) {
  return {
    /**
     * Insert many notifications in batches.
     *
     * @param {object[]} notifications Notifications with id, userId, role, subjectName, oldSlot, newSlot, dayOfWeek and message.
     * @returns {Promise<void>}
     */
    async insertMany(notifications) {
      for (const batch of chunk(notifications, INSERT_CHUNK_SIZE)) {
        await db.notification.createMany({
          data: batch.map((item) => ({
            id: item.id,
            userId: item.userId,
            role: item.role,
            subjectName: item.subjectName,
            oldSlot: item.oldSlot,
            newSlot: item.newSlot,
            dayOfWeek: item.dayOfWeek,
            message: item.message,
            status: NOTIFICATION_STATUS.UNREAD
          }))
        });
      }
    },

    /**
     * List a user's unread notifications, newest first.
     *
     * @param {string} userId User id.
     * @returns {Promise<object[]>}
     */
    findUnreadByUser(userId) {
      return db.notification.findMany({
        where: { userId, status: NOTIFICATION_STATUS.UNREAD },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }]
      });
    },

    /**
     * Count a user's unread notifications.
     *
     * @param {string} userId User id.
     * @returns {Promise<number>}
     */
    countUnreadByUser(userId) {
      return db.notification.count({ where: { userId, status: NOTIFICATION_STATUS.UNREAD } });
    },

    /**
     * Mark one of a user's notifications as read.
     *
     * @param {string} id Notification id.
     * @param {string} userId Owner of the notification.
     * @returns {Promise<object | null>} Updated notification, or null if the user does not own it.
     */
    async markAsRead(id, userId) {
      const existing = await db.notification.findFirst({ where: { id, userId } });
      if (!existing) return null;

      return db.notification.update({
        where: { id },
        data: { status: NOTIFICATION_STATUS.READ, readAt: existing.readAt ?? new Date() }
      });
    },

    /**
     * Mark every unread notification of a user as read.
     *
     * @param {string} userId Owner of the notifications.
     * @returns {Promise<number>} Number of notifications updated.
     */
    async markAllAsRead(userId) {
      const { count } = await db.notification.updateMany({
        where: { userId, status: NOTIFICATION_STATUS.UNREAD },
        data: { status: NOTIFICATION_STATUS.READ, readAt: new Date() }
      });
      return count;
    }
  };
}
