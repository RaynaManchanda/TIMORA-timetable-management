/**
 * TIMORA - Frontend, Analytics & User Workflows Verification Tests
 * Person 3: Rohit (Frontend, Analytics & User Workflows)
 * Verifies TC01 through TC18 from the consolidated test document against the real API
 * (PostgreSQL through Prisma) and the real frontend source files.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import supertest from 'supertest';

import { createDemoApp, DEMO_PASSWORD } from '../../tests/support/demo-app.js';

const { app, close: closeApp } = await createDemoApp();
after(closeApp);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', '..', 'public');
const readPublic = (name) => fs.readFileSync(path.join(publicDir, name), 'utf-8');

/**
 * Send a request to the application and return status and parsed body.
 *
 * @param {string} method HTTP method.
 * @param {string} url Request path.
 * @param {{ token?: string, body?: object }} [options] Bearer token and JSON body.
 * @returns {Promise<{ status: number, body: object }>}
 */
async function request(method, url, { token, body } = {}) {
  let call = supertest(app)[method.toLowerCase()](url);
  if (token) call = call.set('Authorization', `Bearer ${token}`);
  if (body) call = call.send(body);
  const response = await call;
  return { status: response.status, body: response.body };
}

/**
 * Sign in as one of the demo accounts and return the token.
 *
 * @param {string} email Demo account email.
 * @returns {Promise<string>}
 */
async function signIn(email) {
  const response = await request('POST', '/api/auth/login', { body: { email, password: DEMO_PASSWORD } });
  assert.strictEqual(response.status, 200);
  return response.body.token;
}

test('TC01 - Verify sign-in and role-based page routing', async () => {
  const coordLogin = await request('POST', '/api/auth/login', { body: { email: 'admin@timora.edu', password: DEMO_PASSWORD } });
  assert.strictEqual(coordLogin.status, 200);
  assert.strictEqual(coordLogin.body.user.role, 'COORDINATOR');

  const facLogin = await request('POST', '/api/auth/login', { body: { email: 'turing@univ.edu', password: DEMO_PASSWORD } });
  assert.strictEqual(facLogin.status, 200);
  assert.strictEqual(facLogin.body.user.role, 'FACULTY');

  const stuLogin = await request('POST', '/api/auth/login', { body: { email: 'student@timora.edu', password: DEMO_PASSWORD } });
  assert.strictEqual(stuLogin.status, 200);
  assert.strictEqual(stuLogin.body.user.role, 'STUDENT');

  // Verify routing logic in app.js
  const appJs = readPublic('app.js');
  assert.ok(appJs.includes("navigateTo('dashboard')"));
  assert.ok(appJs.includes("navigateTo('timetable')"));
});

test('TC01b - the sign-in screen has no pre-filled credentials and the API refuses anonymous callers', async () => {
  const html = readPublic('index.html');
  assert.ok(!html.includes('value="Password123!"'));
  assert.ok(!/id="signin-email"[^>]*value=/.test(html));

  for (const url of ['/api/rescheduling/versions', '/api/rescheduling/metadata', '/api/rescheduling/disruptions', '/api/academic/rooms', '/api/notifications']) {
    const response = await request('GET', url);
    assert.strictEqual(response.status, 401, `${url} must need a token`);
  }
  assert.strictEqual((await request('POST', '/api/ai/interpret', { body: { prompt: 'x' } })).status, 401);
});

test('TC02 - Verify dashboard summary and activity', async () => {
  const token = await signIn('admin@timora.edu');

  const versionsRes = await request('GET', '/api/rescheduling/versions', { token });
  assert.strictEqual(versionsRes.status, 200);
  assert.ok(versionsRes.body.activeVersion);
  assert.ok(versionsRes.body.activeVersion.metrics, 'dashboard figures are computed by the server');
  assert.ok(versionsRes.body.activeVersion.metrics.qualityScore >= 0);

  const disruptionsRes = await request('GET', '/api/rescheduling/disruptions', { token });
  assert.strictEqual(disruptionsRes.status, 200);

  // Check HTML contains dashboard elements: quality score, avoidable gaps, scheduled classes, open disruptions
  const html = readPublic('index.html');
  assert.ok(html.includes('id="dash-quality-score"'));
  assert.ok(html.includes('id="dash-avoidable-gaps"'));
  assert.ok(html.includes('id="dash-scheduled-classes"'));
  assert.ok(html.includes('id="dash-open-disruptions"'));
  assert.ok(html.includes('Needs Attention'));
  assert.ok(html.includes('Recent Activity'));
});

test('TC03 - Verify weekly timetable display', () => {
  const html = readPublic('index.html');
  assert.ok(html.includes('id="timetable-matrix-container"'));
  const appJs = readPublic('app.js');
  assert.ok(appJs.includes('tt-slot-card'));
  assert.ok(appJs.includes('Free Period'));
  // Lunch, mentoring and minor-programme time of the college sheet are drawn as reserved blocks.
  assert.ok(appJs.includes('tt-block'));
  assert.ok(appJs.includes("LUNCH: 'Lunch'"));
});

test('TC04 - Verify timetable view selector', () => {
  const html = readPublic('index.html');
  assert.ok(html.includes('id="tt-view-selector"'));
  assert.ok(html.includes('value="WEEK"'));
  assert.ok(html.includes('value="TODAY"'));
});

test('TC05 - Verify timetable print action', () => {
  assert.ok(readPublic('app.js').includes('window.print()'));
  assert.ok(readPublic('styles.css').includes('@media print'));
});

test('TC06 - Verify Google Calendar sync message', async () => {
  const token = await signIn('admin@timora.edu');

  // A coordinator has no section of their own and must choose one.
  assert.strictEqual((await request('GET', '/api/calendar/events', { token })).status, 400);
  const calEvents = await request('GET', '/api/calendar/events?sectionId=SEC_CSE_5A', { token });
  assert.strictEqual(calEvents.status, 200);
  assert.strictEqual(calEvents.body.timeZone, 'Asia/Kolkata');
  assert.ok(calEvents.body.count >= 0);
});

test('TC07 - Verify academic data category tabs', () => {
  const html = readPublic('index.html');
  assert.ok(html.includes('data-tab="subjects"'));
  assert.ok(html.includes('data-tab="faculty"'));
  assert.ok(html.includes('data-tab="rooms"'));
  assert.ok(html.includes('data-tab="sections"'));
});

test('TC08 - Verify Add record action', async () => {
  const token = await signIn('admin@timora.edu');

  const addSub = await request('POST', '/api/academic/subjects', {
    token,
    body: { code: 'CS509', name: 'Cloud Computing', type: 'LECTURE', requiredHoursPerWeek: 3, credits: 3 }
  });

  assert.strictEqual(addSub.status, 201);
  assert.strictEqual(addSub.body.subject.code, 'CS509');
  assert.strictEqual(addSub.body.message, 'Subject added successfully.');

  // The record is stored in the database and is served again to every signed-in user.
  const list = await request('GET', '/api/academic/subjects', { token: await signIn('student@timora.edu') });
  assert.ok(list.body.subjects.some((subject) => subject.code === 'CS509'));

  // A student may read the lists but not change them.
  const denied = await request('POST', '/api/academic/subjects', {
    token: await signIn('student@timora.edu'),
    body: { code: 'CS999', name: 'Nope' }
  });
  assert.strictEqual(denied.status, 403);
});

test('TC09 - Verify disruption input controls', () => {
  const html = readPublic('index.html');
  assert.ok(html.includes('id="dis-type"'));
  assert.ok(html.includes('id="dis-faculty"'));
  assert.ok(html.includes('id="dis-day"'));
  assert.ok(html.includes('id="dis-slot"'));
  assert.ok(html.includes('id="btn-analyze-impact"'));
  // Every offered disruption type must be one the server understands.
  for (const [, type] of html.matchAll(/<option value="([A-Z_]+)">[^<]*(?:absence|cancelled|unavailable|Holiday|swap)/gi)) {
    assert.ok(
      ['FACULTY_ABSENCE', 'CLASS_CANCELLATION', 'ROOM_UNAVAILABILITY', 'HOLIDAY', 'SWAP_REQUEST'].includes(type),
      `unknown disruption type ${type}`
    );
  }
});

test('TC10 - Verify disruption impact analysis', async () => {
  const token = await signIn('admin@timora.edu');

  const disRes = await request('POST', '/api/rescheduling/disruptions', {
    token,
    body: { disruptionType: 'FACULTY_ABSENCE', affectedEntityType: 'FACULTY', affectedEntityId: 'F101', dayOfWeek: 'Tuesday', slotId: 'S2', reason: 'Sick leave' }
  });
  assert.strictEqual(disRes.status, 201);

  const altRes = await request('POST', '/api/rescheduling/generate-alternatives', { token, body: { disruptionId: disRes.body.disruption.id } });
  assert.strictEqual(altRes.status, 200);
  assert.ok(altRes.body.impactResult.affectedEntries.length > 0);
  assert.ok(altRes.body.comparisonPayload.rankedAlternatives.length > 0);
});

test('TC11 - Verify selection and approval of a rescheduling alternative', async () => {
  const token = await signIn('admin@timora.edu');

  const disRes = await request('POST', '/api/rescheduling/disruptions', {
    token,
    body: { disruptionType: 'FACULTY_ABSENCE', affectedEntityType: 'FACULTY', affectedEntityId: 'F102', dayOfWeek: 'Tuesday', slotId: 'S5' }
  });
  const altRes = await request('POST', '/api/rescheduling/generate-alternatives', { token, body: { disruptionId: disRes.body.disruption.id } });
  const chosen = altRes.body.comparisonPayload.rankedAlternatives[0];

  const approveRes = await request('POST', '/api/rescheduling/approve', {
    token,
    body: { alternativeId: chosen.id, disruptionId: disRes.body.disruption.id, approvalNotes: 'Approved best alternative.' }
  });

  assert.strictEqual(approveRes.status, 200);
  assert.strictEqual(approveRes.body.success, true);
  assert.ok(approveRes.body.activeVersion);
  assert.strictEqual(approveRes.body.version.approvedBy, 'Academic Coordinator');
});

test('TC12 - Verify timetable generation settings', () => {
  const html = readPublic('index.html');
  assert.ok(html.includes('id="gen-section-select"'));
  assert.ok(html.includes('id="gen-max-gap"'));
  assert.ok(html.includes('id="gen-mandatory-break"'));
  assert.ok(html.includes('id="btn-run-generation"'));
});

test('TC13 - Verify timetable generation results', async () => {
  const token = await signIn('admin@timora.edu');

  const genRes = await request('POST', '/api/admin/timetables/generate', {
    token,
    body: { sectionId: 'SEC_CSE_5A', maxGapHours: 2, mandatoryBreak: true }
  });

  assert.strictEqual(genRes.status, 200);
  assert.strictEqual(genRes.body.status, 'OPTIMAL');
  assert.ok(genRes.body.qualityScore > 0);
  assert.strictEqual(genRes.body.metrics.hardConstraintConflicts, 0);
  assert.ok(genRes.body.draftVersionId, 'the result is stored as a draft until an administrator publishes it');

  // A draft can be discarded without touching the active timetable.
  const discard = await request('DELETE', `/api/admin/timetables/drafts/${genRes.body.draftVersionId}`, { token });
  assert.strictEqual(discard.status, 200);
});

test('TC14 - Verify generated timetable approval and rejection controls', () => {
  const html = readPublic('index.html');
  assert.ok(html.includes('id="btn-approve-publish"'));
  assert.ok(html.includes('id="btn-reject-draft"'));
  assert.ok(readPublic('app.js').includes('/drafts/'));
});

test('TC15 - Verify versions and analytics display', async () => {
  const token = await signIn('admin@timora.edu');
  const versionsRes = await request('GET', '/api/rescheduling/versions', { token });
  assert.strictEqual(versionsRes.status, 200);
  assert.ok(versionsRes.body.versions.length >= 1);

  const html = readPublic('index.html');
  assert.ok(html.includes('id="ana-avg-gap"'));
  assert.ok(html.includes('id="ana-room-util"'));
  assert.ok(html.includes('id="ana-fac-workload"'));
  assert.ok(html.includes('id="ana-stability"'));
});

test('TC16 - Verify rollback action for an archived version', async () => {
  const token = await signIn('admin@timora.edu');
  const versionsRes = await request('GET', '/api/rescheduling/versions', { token });
  const archived = versionsRes.body.versions.find((version) => version.status === 'ARCHIVED');
  assert.ok(archived, 'TC11 created a new version, so an archived one exists');

  const rollbackRes = await request('POST', `/api/rescheduling/versions/${archived.id}/rollback`, { token });
  assert.strictEqual(rollbackRes.status, 200);
  assert.strictEqual(rollbackRes.body.activeVersion.id, archived.id);
});

test('TC17 - Verify sign-out navigation', () => {
  const html = readPublic('index.html');
  assert.ok(html.includes('id="btn-signout"'));
  const appJs = readPublic('app.js');
  assert.ok(appJs.includes("sessionStorage.removeItem('timora_token')"));
  assert.ok(appJs.includes("sessionStorage.removeItem('timora_user')"));
  assert.ok(appJs.includes('clearLoadedData'), 'sign-out wipes the loaded timetable from memory');
});

test('TC18 - Verify role-specific timetable access', async () => {
  const studentToken = await signIn('student@timora.edu');

  const timetableRes = await request('GET', '/api/timetables', { token: studentToken });
  assert.strictEqual(timetableRes.status, 200);
  assert.ok(Array.isArray(timetableRes.body.entries));

  // The student is refused another section's timetable and every planning endpoint.
  assert.strictEqual((await request('GET', '/api/timetables', { token: studentToken })).body.entries.every((e) => e.sectionId === 'SEC_CSE_5A' || e.coSectionIds.includes('SEC_CSE_5A')), true);
  assert.strictEqual((await request('GET', '/api/timetables?section=SEC_CSE_5B', { token: studentToken })).status, 403);
  assert.strictEqual((await request('GET', '/api/rescheduling/disruptions', { token: studentToken })).status, 403);
  assert.strictEqual((await request('POST', '/api/rescheduling/approve', { token: studentToken, body: {} })).status, 403);

  // The active timetable served to a student contains only their own section.
  const overview = await request('GET', '/api/rescheduling/versions', { token: studentToken });
  assert.ok(overview.body.activeVersion.entries.every((e) => e.sectionId === 'SEC_CSE_5A' || e.coSectionIds.includes('SEC_CSE_5A')));
  assert.strictEqual(overview.body.versions.length, 1);
});
