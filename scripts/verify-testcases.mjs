/**
 * Runs the test cases of the four team members and prints one PASS/FAIL line per test case.
 *
 *   npm run test:db:up                    (isolated PostgreSQL on port 5433, once)
 *   npm run test:testcases                everyone
 *   npm run test:testcases -- rayna       one person: rishank | rayna | rohit | raghav
 *
 * Rishank / Rayna / Rohit: node:test files in testcases/<name>/.  Raghav: the Jest suite in tests/backend.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TITLES = {
  rishank: {
    name: 'Rishank Mishra - Core Scheduling & Optimization',
    TC01: 'Generate a feasible timetable with valid constraints',
    TC02: 'Reject infeasible input (room capacity insufficient)',
    TC03: 'Prevent faculty double-booking',
    TC04: 'Verify all required sessions are scheduled'
  },
  rayna: {
    name: 'Rayna Manchanda - Adaptive Rescheduling & AI Assistance',
    TC01: 'Report a valid disruption',
    TC02: 'Reject a disruption with a missing affected entity ID',
    TC03: 'Analyze the impact of a faculty absence',
    TC04: 'Generate and rank alternative schedules',
    TC05: 'Approve an alternative and create a new timetable version',
    TC06: 'Process a scheduling request using AI assistance',
    TC07: 'Reject an invalid disruption type',
    TC08: 'Reject approval when no valid alternative is provided',
    TC09: 'Reject approval when the disruption ID is missing',
    TC10: 'Preserve all entries when no timetable entries match the disruption',
    TC11: 'Return No Changes Needed when no entries are affected',
    TC12: 'Reject an empty AI prompt',
    TC13: 'Reject validation without an interpreted constraint'
  },
  rohit: {
    name: 'Rohit - Frontend, Analytics & User Workflows',
    TC01: 'Verify sign-in and role-based page routing',
    TC02: 'Verify dashboard summary and activity',
    TC03: 'Verify weekly timetable display',
    TC04: 'Verify timetable view selector',
    TC05: 'Verify timetable print action',
    TC06: 'Verify Google Calendar sync message',
    TC07: 'Verify academic data category tabs',
    TC08: 'Verify Add record action',
    TC09: 'Verify disruption input controls',
    TC10: 'Verify disruption impact analysis',
    TC11: 'Verify selection and approval of a rescheduling alternative',
    TC12: 'Verify timetable generation settings',
    TC13: 'Verify timetable generation results',
    TC14: 'Verify generated timetable approval and rejection controls',
    TC15: 'Verify versions and analytics display',
    TC16: 'Verify rollback action for an archived version',
    TC17: 'Verify sign-out navigation',
    TC18: 'Verify role-specific timetable access'
  },
  raghav: {
    name: 'Raghav Yadav - Backend, Database, Quality & DevOps',
    TC01: 'Register a new user with valid details',
    TC02: 'Reject registration with a duplicate email',
    TC03: 'Log in with valid credentials',
    TC04: 'Reject login with an incorrect password',
    TC05: 'Store passwords only in hashed form',
    TC06: 'Block a protected route without an access token',
    TC07: 'Reject a tampered or expired access token',
    TC08: 'Enforce role-based access on administrator routes',
    TC09: 'Create a timetable entry through the REST API',
    TC10: 'Reject a timetable entry with missing required fields',
    TC11: 'Fetch the timetable for a specific section',
    TC12: 'Prevent double booking of a room in the same slot',
    TC13: 'Roll back a failed timetable version save',
    TC14: 'Create notifications when a reschedule is approved',
    TC15: 'Fetch and mark notifications as read',
    TC16: 'Build Google Calendar events from a timetable',
    TC17: 'Handle an expired Google Calendar authorization',
    TC18: 'Reject SQL-injection input in API parameters',
    TC19: 'Limit repeated failed login attempts',
    TC20: 'Maintain API performance under concurrent load'
  }
};

/** Run one person's tests and return [{ id, ok }] for every test whose name starts with a TC id. */
function execute(person) {
  if (person === 'raghav') {
    const out = join(mkdtempSync(join(tmpdir(), 'timora-tc-')), 'result.json');
    spawnSync(process.execPath, ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', 'tests/backend', '--json', `--outputFile=${out}`], {
      stdio: ['ignore', 'ignore', 'ignore']
    });
    const report = JSON.parse(readFileSync(out, 'utf8'));
    return report.testResults.flatMap((file) => file.assertionResults).map((t) => ({ title: t.title, ok: t.status === 'passed' }));
  }
  const run = spawnSync(process.execPath, ['--test', `testcases/${person}/${person}.testcases.test.js`], { encoding: 'utf8' });
  const results = [];
  for (const line of run.stdout.split('\n')) {
    const match = /^\s*(✔|✖)\s+(TC\d+\w*\s-\s.*?)\s+\([\d.]+ms\)/.exec(line);
    if (match) results.push({ title: match[2], ok: match[1] === '✔' });
  }
  return results;
}

const requested = process.argv[2]?.toLowerCase();
const people = requested ? [requested] : Object.keys(TITLES);
if (people.some((p) => !TITLES[p])) {
  console.error(`Unknown name "${requested}". Use: ${Object.keys(TITLES).join(' | ')}`);
  process.exit(2);
}

let failed = 0;
let total = 0;
for (const person of people) {
  const { name, ...cases } = TITLES[person];
  console.log(`\n=== ${name} ===`);
  let results;
  try {
    results = execute(person);
  } catch {
    console.error('No result. Is the test database up? (npm run test:db:up)');
    process.exit(2);
  }
  for (const [id, title] of Object.entries(cases)) {
    const mine = results.filter((r) => new RegExp(`^${id}\\b`).test(r.title));
    const ok = mine.length > 0 && mine.every((r) => r.ok);
    total += 1;
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${title}  (${mine.length} check${mine.length === 1 ? '' : 's'})`);
  }
}
console.log(`\n${total - failed} of ${total} test cases pass.`);
process.exit(failed === 0 ? 0 : 1);
