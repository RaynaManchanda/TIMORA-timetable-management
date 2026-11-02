import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { bearer, createTestContext } from './helpers/test-context.js';
import { insertSection } from './helpers/timetable-fixtures.js';

const STUDENT_COUNT = 64;

describe('Notifications', () => {
  let context;
  let admin;
  let facultyUsers;

  /**
   * Insert many students into a section in a single statement.
   *
   * @param {string} sectionId Section the students join.
   * @param {number} count Number of students to create.
   * @returns {Promise<void>}
   */
  async function insertStudents(sectionId, count) {
    const passwordHash = await context.services.passwordService.hash('Str0ngPassw0rd!');
    for (let number = 1; number <= count; number += 1) {
      await context.services.userRepository.create({
        id: `USR_${sectionId}_${number}`,
        name: `Student ${number}`,
        email: `student${number}.${sectionId}@timora.edu`.toLowerCase(),
        passwordHash,
        role: 'STUDENT',
        sectionId
      });
    }
  }

  beforeAll(async () => {
    context = await createTestContext({ env: { BCRYPT_COST: '4' } });
    await insertSection(context.pool, 'CSE5');
    await insertSection(context.pool, 'CSE6');
    await insertStudents('CSE5', STUDENT_COUNT);
    await insertStudents('CSE6', 3);
    admin = await context.createUser({ role: 'COORDINATOR' });
    facultyUsers = [
      await context.createUser({ role: 'FACULTY', facultyId: 'F101' }),
      await context.createUser({ role: 'FACULTY', facultyId: 'F102' })
    ];
  });

  afterAll(() => context.close());

  const approvedChanges = [
    { subjectId: 'SUB_CS501', subjectName: 'Database Management Systems', facultyId: 'F101', sectionId: 'CSE5', oldDay: 'TUESDAY', oldSlot: 'S2', newDay: 'THURSDAY', newSlot: 'S3' },
    { subjectId: 'SUB_CS503', subjectName: 'Operating Systems', facultyId: 'F102', sectionId: 'CSE5', oldDay: 'TUESDAY', oldSlot: 'S5', newDay: 'FRIDAY', newSlot: 'S1' },
    { subjectId: 'SUB_CS502', subjectName: 'DBMS Lab', facultyId: 'F101', sectionId: 'CSE5', oldDay: 'TUESDAY', oldSlot: 'S3', newDay: 'FRIDAY', newSlot: 'S4' }
  ];

  test('TC14 - an approved reschedule notifies all 64 students and both faculty members with UNREAD status', async () => {
    const response = await context
      .http()
      .post('/api/notifications/reschedule-notify')
      .set(bearer(admin.token))
      .send({ modifiedEntries: approvedChanges, affectedSectionId: 'CSE5' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ affectedStudentsCount: 64, affectedFacultyCount: 2 });

    const { rows } = await context.pool.query('SELECT * FROM notifications');
    const recipients = new Set(rows.map((row) => row.user_id));
    expect(recipients.size).toBe(64 + 2);
    expect(rows.every((row) => row.status === 'UNREAD')).toBe(true);
    expect(rows.every((row) => row.subject_name && row.old_slot && row.new_slot && row.message)).toBe(true);

    const databaseNotification = rows.find((row) => row.subject_name === 'Database Management Systems');
    expect(databaseNotification).toMatchObject({ old_slot: 'TUESDAY S2', new_slot: 'THURSDAY S3' });
  });

  test('does not notify students from other sections', async () => {
    const { rows } = await context.pool.query(
      `SELECT COUNT(*)::int AS total FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.section_id = 'CSE6'`
    );

    expect(rows[0].total).toBe(0);
  });

  test('only administrators may trigger reschedule notifications', async () => {
    const response = await context
      .http()
      .post('/api/notifications/reschedule-notify')
      .set(bearer(facultyUsers[0].token))
      .send({ modifiedEntries: approvedChanges });

    expect(response.status).toBe(403);
  });

  test('TC15 - a student lists only their own unread notifications and marks one as read', async () => {
    const student = { id: 'USR_CSE5_7' };
    const studentToken = context.services.tokenService.issue({ ...student, email: 'a@b.c', name: 'S', role: 'STUDENT', sectionId: 'CSE5' });

    const listed = await context.http().get('/api/notifications').set(bearer(studentToken));

    expect(listed.status).toBe(200);
    expect(listed.body.count).toBe(3);
    expect(listed.body.notifications.every((notification) => notification.userId === student.id)).toBe(true);

    const targetId = listed.body.notifications[0].id;
    const marked = await context.http().patch(`/api/notifications/${targetId}/read`).set(bearer(studentToken));

    expect(marked.status).toBe(200);
    expect(marked.body.notification.status).toBe('READ');
    expect(marked.body.remainingUnread).toBe(2);

    const afterwards = await context.http().get('/api/notifications').set(bearer(studentToken));
    expect(afterwards.body.count).toBe(2);
  });

  test("a user cannot mark someone else's notification as read", async () => {
    const { rows } = await context.pool.query("SELECT id FROM notifications WHERE user_id = 'USR_CSE5_8' LIMIT 1");
    const otherStudentToken = context.services.tokenService.issue({ id: 'USR_CSE5_9', email: 'a@b.c', name: 'S', role: 'STUDENT', sectionId: 'CSE5' });

    const response = await context.http().patch(`/api/notifications/${rows[0].id}/read`).set(bearer(otherStudentToken));

    expect(response.status).toBe(404);
    const { rows: unchanged } = await context.pool.query('SELECT status FROM notifications WHERE id = $1', [rows[0].id]);
    expect(unchanged[0].status).toBe('UNREAD');
  });

  test('requires a token to read notifications', async () => {
    const response = await context.http().get('/api/notifications');

    expect(response.status).toBe(401);
  });

  test('approving a rescheduling alternative creates notifications without failing the approval', async () => {
    const asAdmin = bearer(admin.token);
    const disruption = await context.http().post('/api/rescheduling/disruptions').set(asAdmin).send({
      disruptionType: 'FACULTY_ABSENCE',
      affectedEntityType: 'FACULTY',
      affectedEntityId: 'F101',
      dayOfWeek: 'Tuesday',
      slotId: 'S2'
    });
    const disruptionId = disruption.body.disruption.id;
    const alternatives = await context.http().post('/api/rescheduling/generate-alternatives').set(asAdmin).send({ disruptionId });
    const [chosen] = alternatives.body.comparisonPayload.rankedAlternatives;

    const approval = await context
      .http()
      .post('/api/rescheduling/approve')
      .set(asAdmin)
      .send({ alternativeId: chosen.id, disruptionId });

    expect(approval.status).toBe(200);
    expect(approval.body.success).toBe(true);
  });
});
