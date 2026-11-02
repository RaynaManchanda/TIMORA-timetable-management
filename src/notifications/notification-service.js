import { withTransaction } from '../db/transaction.js';
import { NotFoundError } from '../errors/app-errors.js';
import { ROLES } from '../constants/roles.js';
import { createNotificationRepository } from '../repositories/notification-repository.js';
import { createUserRepository } from '../repositories/user-repository.js';
import { generateId } from '../utils/id-generator.js';

/**
 * Describe a changed class in the wording used by notifications.
 *
 * @param {object} change A modified timetable entry from an approved reschedule.
 * @returns {{ subjectName: string, oldSlot: string, newSlot: string, dayOfWeek: string | undefined }}
 */
function describeChange(change) {
  return {
    subjectName: change.subjectName || change.subjectId || 'Subject',
    oldSlot: `${change.oldDay || ''} ${change.oldSlot || ''}`.trim(),
    newSlot: `${change.newDay || ''} ${change.newSlot || change.newSlotLabel || ''}`.trim(),
    dayOfWeek: change.newDay || change.oldDay
  };
}

/**
 * Build one unread notification for one recipient and one changed class.
 *
 * @param {{ id: string, role: string }} recipient User receiving the notification.
 * @param {object} change A modified timetable entry.
 * @returns {object} Notification ready to insert.
 */
function buildNotification(recipient, change) {
  const description = describeChange(change);
  const prefix = recipient.role === ROLES.FACULTY ? 'Class rescheduled' : 'Timetable update';

  return {
    id: generateId('NOTIF'),
    userId: recipient.id,
    role: recipient.role,
    ...description,
    message: `${prefix}: ${description.subjectName} moved from ${description.oldSlot} to ${description.newSlot}.`
  };
}

/**
 * Create the notification service.
 *
 * @param {{ prisma: import('@prisma/client').PrismaClient }} dependencies Collaborators.
 */
export function createNotificationService({ prisma }) {
  const userRepository = createUserRepository(prisma);
  const notificationRepository = createNotificationRepository(prisma);

  return {
    /**
     * Notify every affected student and faculty member about an approved reschedule.
     * All notifications are written in one transaction.
     *
     * @param {{ modifiedEntries: object[], affectedSectionId?: string }} approval Changes from the approved alternative.
     * @returns {Promise<{ count: number, affectedStudentsCount: number, affectedFacultyCount: number }>}
     */
    async notifyRescheduleApproved({ modifiedEntries = [], affectedSectionId }) {
      const studentsBySection = new Map();
      const facultyIds = (change) => change.facultyIds ?? [change.facultyId].filter(Boolean);
      const facultyUsers = await userRepository.findByFacultyIds([...new Set(modifiedEntries.flatMap(facultyIds))]);
      const notifications = [];
      const notifiedUserIds = { students: new Set(), faculty: new Set() };

      for (const change of modifiedEntries) {
        // A combined class is attended by several sections; every one of them is told.
        const sectionIds = change.sectionIds ?? [change.sectionId || affectedSectionId].filter(Boolean);
        const students = [];
        for (const sectionId of sectionIds) {
          if (!studentsBySection.has(sectionId)) {
            studentsBySection.set(sectionId, await userRepository.findStudentsBySection(sectionId));
          }
          students.push(...studentsBySection.get(sectionId));
        }
        const involvedFaculty = new Set(facultyIds(change));
        const faculty = facultyUsers.filter((user) => involvedFaculty.has(user.facultyId));

        for (const student of students) {
          notifications.push(buildNotification(student, change));
          notifiedUserIds.students.add(student.id);
        }
        for (const member of faculty) {
          notifications.push(buildNotification(member, change));
          notifiedUserIds.faculty.add(member.id);
        }
      }

      await withTransaction(prisma, (tx) => createNotificationRepository(tx).insertMany(notifications));

      return {
        count: notifications.length,
        affectedStudentsCount: notifiedUserIds.students.size,
        affectedFacultyCount: notifiedUserIds.faculty.size
      };
    },

    /**
     * List a user's unread notifications.
     *
     * @param {string} userId User id.
     * @returns {Promise<object[]>}
     */
    listUnread(userId) {
      return notificationRepository.findUnreadByUser(userId);
    },

    /**
     * Mark every unread notification of the user as read.
     *
     * @param {string} userId Authenticated user id.
     * @returns {Promise<{ updated: number }>}
     */
    async markAllAsRead(userId) {
      return { updated: await notificationRepository.markAllAsRead(userId) };
    },

    /**
     * Mark one of the user's notifications as read.
     *
     * @param {string} notificationId Notification id.
     * @param {string} userId Authenticated user id.
     * @returns {Promise<{ notification: object, remainingUnread: number }>}
     */
    async markAsRead(notificationId, userId) {
      const notification = await notificationRepository.markAsRead(notificationId, userId);
      if (!notification) {
        throw new NotFoundError(`Notification ${notificationId} not found.`);
      }

      const remainingUnread = await notificationRepository.countUnreadByUser(userId);
      return { notification, remainingUnread };
    }
  };
}
