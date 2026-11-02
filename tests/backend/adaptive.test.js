import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { bearer, createTestContext } from './helpers/test-context.js';

describe('Adaptive rescheduling (database backed, administrators only)', () => {
  let context;
  let admin;
  let student;
  let facultyUser;

  beforeAll(async () => {
    context = await createTestContext({ withEntries: true, env: { BCRYPT_COST: '4' } });
    admin = await context.createUser({ role: 'COORDINATOR' });
    student = await context.createUser({ role: 'STUDENT', sectionId: 'SEC_CSE_5A' });
    facultyUser = await context.createUser({ role: 'FACULTY', facultyId: 'F101' });
  });

  afterAll(() => context.close());

  const post = (url, body, user = admin) => context.http().post(url).set(bearer(user.token)).send(body);
  const get = (url, user = admin) => context.http().get(url).set(bearer(user.token));

  const recordAbsence = async (facultyId, dayOfWeek, slotId) => {
    const response = await post('/api/rescheduling/disruptions', {
      disruptionType: 'FACULTY_ABSENCE', affectedEntityType: 'FACULTY', affectedEntityId: facultyId, dayOfWeek, slotId, reason: 'Leave'
    });
    expect(response.status).toBe(201);
    return response.body.disruption;
  };

  test('every rescheduling and AI route refuses anonymous callers and students', async () => {
    const routes = [
      ['get', '/api/rescheduling/disruptions'],
      ['post', '/api/rescheduling/disruptions'],
      ['post', '/api/rescheduling/generate-alternatives'],
      ['post', '/api/rescheduling/approve'],
      ['post', '/api/rescheduling/versions/VER_1.0/rollback'],
      ['post', '/api/ai/interpret'],
      ['post', '/api/admin/timetables/generate']
    ];
    for (const [method, url] of routes) {
      expect((await context.http()[method](url).send({})).status).toBe(401);
      expect((await context.http()[method](url).set(bearer(student.token)).send({})).status).toBe(403);
      expect((await context.http()[method](url).set(bearer(facultyUser.token)).send({})).status).toBe(403);
    }
  });

  test('a disruption is validated and stored with the reporting administrator', async () => {
    const bad = await post('/api/rescheduling/disruptions', { disruptionType: 'MAGIC', affectedEntityId: 'F101', dayOfWeek: 'Tuesday' });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/Invalid disruption type/);

    const unknown = await post('/api/rescheduling/disruptions', { disruptionType: 'FACULTY_ABSENCE', affectedEntityId: 'F999', dayOfWeek: 'Tuesday' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toBe('Unknown faculty: F999');

    const saved = await recordAbsence('F101', 'Wednesday', 'S1');
    expect(saved).toMatchObject({ status: 'RECORDED', reportedBy: 'Test COORDINATOR' });
    const row = await context.prisma.disruption.findUnique({ where: { id: saved.id } });
    expect(row.disruptionType).toBe('FACULTY_ABSENCE');
  });

  test('every proposed alternative keeps ALL classes and moves the affected ones away from the absence', async () => {
    const disruption = await recordAbsence('F101', 'Tuesday', undefined);

    const response = await post('/api/rescheduling/generate-alternatives', { disruptionId: disruption.id });

    expect(response.status).toBe(200);
    const { impactResult, comparisonPayload } = response.body;
    expect(impactResult.affectedCount).toBe(2);
    expect(comparisonPayload.rankedAlternatives.length).toBeGreaterThan(0);

    for (const alternative of comparisonPayload.rankedAlternatives) {
      expect(alternative.fullTimetableEntries).toHaveLength(impactResult.totalEntries);
      expect(alternative.changeCount).toBe(2);
      // F101 is absent all of Tuesday: no alternative may still ask them to teach then.
      const stillTeaching = alternative.fullTimetableEntries.filter((e) => e.facultyId === 'F101' && e.dayOfWeek === 'Tuesday');
      expect(stillTeaching).toHaveLength(0);
    }
  });

  test('approval rebuilds the timetable on the server, versions it, resolves the disruption and notifies', async () => {
    const disruption = await recordAbsence('F101', 'Tuesday', 'S2');
    const proposed = await post('/api/rescheduling/generate-alternatives', { disruptionId: disruption.id });
    const chosen = proposed.body.comparisonPayload.rankedAlternatives[0];

    const forged = await post('/api/rescheduling/approve', {
      disruptionId: disruption.id,
      alternative: { id: 'ALT_1', fullTimetableEntries: [], modifiedEntries: [] }
    });
    expect(forged.status).toBe(400);

    const unknownChoice = await post('/api/rescheduling/approve', { disruptionId: disruption.id, alternativeId: 'ALT_999' });
    expect(unknownChoice.status).toBe(409);

    const entriesBefore = await context.prisma.timetableEntry.count({ where: { version: { status: 'ACTIVE' } } });
    const approval = await post('/api/rescheduling/approve', { disruptionId: disruption.id, alternativeId: chosen.id, approvalNotes: 'Looks good' });

    expect(approval.status).toBe(200);
    expect(approval.body.version).toMatchObject({ status: 'ACTIVE', approvedBy: 'Test COORDINATOR', disruptionId: disruption.id });

    const versions = await context.prisma.timetableVersion.findMany({ orderBy: { createdAt: 'asc' } });
    expect(versions.filter((v) => v.status === 'ACTIVE')).toHaveLength(1);
    expect(versions.find((v) => v.id === 'VER_1.0').status).toBe('ARCHIVED');
    expect(await context.prisma.timetableEntry.count({ where: { version: { status: 'ACTIVE' } } })).toBe(entriesBefore);

    const resolved = await context.prisma.disruption.findUnique({ where: { id: disruption.id } });
    expect(resolved.status).toBe('RESOLVED');
    const audit = await context.prisma.approvalLog.findFirst({ where: { disruptionId: disruption.id } });
    expect(audit).toMatchObject({ alternativeId: chosen.id, approvedBy: 'Test COORDINATOR', notes: 'Looks good' });

    expect(await context.prisma.notification.count({ where: { userId: student.user.id } })).toBeGreaterThan(0);

    const again = await post('/api/rescheduling/approve', { disruptionId: disruption.id, alternativeId: chosen.id });
    expect(again.status).toBe(409);
  });

  test('students and faculty only receive the timetable that concerns them', async () => {
    const asStudent = await get('/api/rescheduling/versions', student);
    expect(asStudent.status).toBe(200);
    expect(asStudent.body.activeVersion.entries.length).toBeGreaterThan(0);
    expect(asStudent.body.activeVersion.entries.every((e) => e.sectionId === 'SEC_CSE_5A')).toBe(true);
    expect(asStudent.body.versions).toHaveLength(1);
    expect(asStudent.body.activeVersion.metrics).toBeUndefined();

    const asFaculty = await get('/api/rescheduling/versions', facultyUser);
    expect(asFaculty.body.activeVersion.entries.every((e) => e.facultyId === 'F101')).toBe(true);

    const metadata = await get('/api/rescheduling/metadata', student);
    expect(metadata.body.faculty.every((person) => person.email === undefined)).toBe(true);
    expect((await get('/api/rescheduling/metadata', admin)).body.faculty[0].email).toEqual(expect.any(String));
  });

  test('an earlier version can be restored', async () => {
    const rollback = await post('/api/rescheduling/versions/VER_1.0/rollback', {});

    expect(rollback.status).toBe(200);
    expect(rollback.body.activeVersion.id).toBe('VER_1.0');
    const active = await context.prisma.timetableVersion.findMany({ where: { status: 'ACTIVE' } });
    expect(active.map((v) => v.id)).toEqual(['VER_1.0']);

    expect((await post('/api/rescheduling/versions/VER_MISSING/rollback', {})).status).toBe(404);
  });

  test('a generated timetable is only a draft until an administrator publishes it', async () => {
    const generated = await post('/api/admin/timetables/generate', { sectionId: 'SEC_CSE_5A' });
    expect(generated.status).toBe(200);
    expect(generated.body.metrics.hardConstraintConflicts).toBe(0);

    const draft = await context.prisma.timetableVersion.findUnique({ where: { id: generated.body.draftVersionId } });
    expect(draft.status).toBe('DRAFT');
    expect((await context.prisma.timetableVersion.findMany({ where: { status: 'ACTIVE' } })).map((v) => v.id)).toEqual(['VER_1.0']);

    // The other sections' classes are carried over unchanged into the draft.
    const carried = await context.prisma.timetableEntry.count({ where: { versionId: draft.id, sectionId: 'SEC_CSE_5B' } });
    expect(carried).toBe(2);

    const published = await post(`/api/admin/timetables/drafts/${draft.id}/publish`, {});
    expect(published.status).toBe(200);
    expect(published.body.version.status).toBe('ACTIVE');
    expect((await context.prisma.timetableVersion.findMany({ where: { status: 'ACTIVE' } })).map((v) => v.id)).toEqual([draft.id]);

    expect((await post(`/api/admin/timetables/drafts/${draft.id}/publish`, {})).status).toBe(409);
    expect((await context.http().delete('/api/admin/timetables/drafts/VER_1.0').set(bearer(admin.token))).status).toBe(404);
  });
});
