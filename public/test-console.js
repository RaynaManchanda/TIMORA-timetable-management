/**
 * Test console: live checks of the test cases that cannot be clicked through the normal screens
 * (bad input, missing or forged tokens, injection attempts). Every probe sends the real request
 * to this server and compares the answer with the test document. Probes never write data.
 */

const TOKEN_KEY = 'timora_token';
const json = { 'Content-Type': 'application/json' };

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function token() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/** Plain fetch: a probe that expects 401 must not sign the user out. */
async function call(method, url, { body, bearer } = {}) {
  const headers = { ...json };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, message: data.message || data.error || '' };
}

const expectReply = (reply, status, message) => ({
  ok: reply.status === status && (message === undefined || reply.message === message),
  detail: `HTTP ${reply.status}${reply.message ? ` - "${reply.message}"` : ''}`
});

/** Sign in with the credentials typed into the console (default: the demo student). */
async function signInAs(email, password) {
  const reply = await call('POST', '/api/auth/login', { body: { email, password } });
  return reply.status === 200 ? { token: reply.data.token, user: reply.data.user } : null;
}

const PROBES = [
  // ---------------------------------------------------------------- Rishank
  {
    owner: 'Rishank - Core scheduling', id: 'TC02', title: 'Reject infeasible input (room capacity insufficient)',
    expect: 'Generation refuses with a clear "No ... room with capacity >= 500" message and stores nothing',
    async run() {
      const sections = await call('GET', '/api/academic/sections');
      const sectionId = sections.data.sections?.[0]?.id;
      const reply = await call('POST', '/api/admin/timetables/generate', { bearer: token(), body: { sectionId, studentCount: 500 } });
      return { ok: reply.status === 400 && /capacity >= 500/.test(reply.message), detail: `HTTP ${reply.status} - "${reply.message}"` };
    }
  },
  // ---------------------------------------------------------------- Rayna
  {
    owner: 'Rayna - Adaptive rescheduling & AI', id: 'TC02', title: 'Reject a disruption with a missing affected entity ID',
    expect: '400 "Disruption requires an affected entity ID."',
    async run() {
      return expectReply(
        await call('POST', '/api/rescheduling/disruptions', { bearer: token(), body: { disruptionType: 'FACULTY_ABSENCE', affectedEntityId: '', dayOfWeek: 'Monday' } }),
        400, 'Disruption requires an affected entity ID.'
      );
    }
  },
  {
    owner: 'Rayna - Adaptive rescheduling & AI', id: 'TC07', title: 'Reject an invalid disruption type',
    expect: '400 "Invalid disruption type: INVALID_TYPE"',
    async run() {
      return expectReply(
        await call('POST', '/api/rescheduling/disruptions', { bearer: token(), body: { disruptionType: 'INVALID_TYPE', affectedEntityId: 'F101', dayOfWeek: 'Monday' } }),
        400, 'Invalid disruption type: INVALID_TYPE'
      );
    }
  },
  {
    owner: 'Rayna - Adaptive rescheduling & AI', id: 'TC08', title: 'Reject approval when no valid alternative is provided',
    expect: '400 "Valid rescheduling alternative required for approval."',
    async run() {
      return expectReply(
        await call('POST', '/api/rescheduling/approve', { bearer: token(), body: { disruptionId: 'DIS_ANY', alternativeId: null } }),
        400, 'Valid rescheduling alternative required for approval.'
      );
    }
  },
  {
    owner: 'Rayna - Adaptive rescheduling & AI', id: 'TC09', title: 'Reject approval when the disruption ID is missing',
    expect: '400 "Disruption ID is required to approve a rescheduling decision."',
    async run() {
      return expectReply(
        await call('POST', '/api/rescheduling/approve', { bearer: token(), body: { disruptionId: '', alternativeId: 'ALT_1' } }),
        400, 'Disruption ID is required to approve a rescheduling decision.'
      );
    }
  },
  {
    owner: 'Rayna - Adaptive rescheduling & AI', id: 'TC12', title: 'Reject an empty AI prompt (server side)',
    expect: '400 "Natural language prompt text is required."',
    async run() {
      return expectReply(await call('POST', '/api/ai/interpret', { bearer: token(), body: { prompt: '' } }), 400, 'Natural language prompt text is required.');
    }
  },
  {
    owner: 'Rayna - Adaptive rescheduling & AI', id: 'TC13', title: 'Reject validation without an interpreted constraint',
    expect: '400 "Valid interpreted constraint result required for validation."',
    async run() {
      return expectReply(await call('POST', '/api/ai/validate', { bearer: token(), body: {} }), 400, 'Valid interpreted constraint result required for validation.');
    }
  },
  // ---------------------------------------------------------------- Raghav
  {
    owner: 'Raghav - Backend & security', id: 'TC06', title: 'Block a protected route without an access token',
    expect: '401 "Authentication token is required."',
    async run() {
      return expectReply(await call('GET', '/api/timetables'), 401, 'Authentication token is required.');
    }
  },
  {
    owner: 'Raghav - Backend & security', id: 'TC07', title: 'Reject a tampered access token',
    expect: '401 "Invalid authentication token."',
    async run() {
      const [head, payload, signature] = token().split('.');
      const forged = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      // Change the payload (an extra claim and a later expiry) while keeping the old signature.
      forged.tampered = true;
      forged.exp = (forged.exp || 0) + 3600;
      const tampered = [head, btoa(JSON.stringify(forged)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'), signature].join('.');
      return expectReply(await call('GET', '/api/timetables', { bearer: tampered }), 401, 'Invalid authentication token.');
    }
  },
  {
    owner: 'Raghav - Backend & security', id: 'TC08', title: 'Student is denied the administrator generation route',
    expect: '403 "You do not have permission to perform this action." (uses the student account typed above)',
    async run(ctx) {
      const student = await signInAs(ctx.studentEmail(), ctx.studentPassword());
      if (!student) return { ok: false, detail: 'Could not sign in with the student account typed above.' };
      return expectReply(await call('POST', '/api/admin/timetables/generate', { bearer: student.token, body: {} }), 403, 'You do not have permission to perform this action.');
    }
  },
  {
    owner: 'Raghav - Backend & security', id: 'TC10', title: 'Reject a timetable entry with missing required fields',
    expect: '400 listing "facultyId is required" and "slot is required"; nothing is written',
    async run() {
      const reply = await call('POST', '/api/timetables', {
        bearer: token(), body: { sectionId: 'CSE5', subjectId: 'SUB_X', roomId: 'R204', day: 'TUESDAY' }
      });
      const errors = reply.data.validationErrors || [];
      return { ok: reply.status === 400 && errors.includes('facultyId is required') && errors.includes('slot is required'), detail: `HTTP ${reply.status} - ${errors.join('; ')}` };
    }
  },
  {
    owner: 'Raghav - Backend & security', id: 'TC11', title: 'Fetch the timetable for a specific section and day (as the student)',
    expect: '200 with only that section\'s Tuesday classes, ordered by time slot',
    async run(ctx) {
      const student = await signInAs(ctx.studentEmail(), ctx.studentPassword());
      if (!student) return { ok: false, detail: 'Could not sign in with the student account typed above.' };
      const reply = await call('GET', `/api/timetables?section=${encodeURIComponent(student.user.sectionId)}&day=TUESDAY`, { bearer: student.token });
      const list = reply.data.entries || [];
      const slots = list.map((e) => Number(String(e.slot).slice(1)));
      const ordered = slots.every((n, i) => i === 0 || slots[i - 1] <= n);
      const scoped = list.every((e) => e.day === 'TUESDAY' && (e.sectionId === student.user.sectionId || (e.coSectionIds || []).includes(student.user.sectionId)));
      return { ok: reply.status === 200 && list.length > 0 && ordered && scoped, detail: `HTTP ${reply.status} - ${list.length} classes, ordered: ${ordered}, only this section on Tuesday: ${scoped}` };
    }
  },
  {
    owner: 'Raghav - Backend & security', id: 'TC12', title: 'Prevent double booking of a room in the same slot',
    expect: '409 "Room ... is already booked for ... slot ..." (the request is refused, nothing is written)',
    async run() {
      const [all, faculty, rooms] = await Promise.all([
        call('GET', '/api/timetables', { bearer: token() }),
        call('GET', '/api/academic/faculty', { bearer: token() }),
        call('GET', '/api/academic/rooms', { bearer: token() })
      ]);
      const sharedRooms = new Set((rooms.data.rooms || []).filter((r) => r.isShared).map((r) => r.id));
      const entries = all.data.entries || [];
      const busy = new Set(entries.map((e) => e.facultyId));
      const freeTeacher = (faculty.data.faculty || []).find((f) => !busy.has(f.id));
      const target = entries.find((e) => e.roomId && !sharedRooms.has(e.roomId) && !e.isElective);
      if (!target || !freeTeacher) return { ok: false, detail: 'No suitable existing class found to collide with.' };
      const taken = new Set(entries.filter((e) => e.day === target.day && e.slot === target.slot).map((e) => e.sectionId));
      const section = [...new Set(entries.map((e) => e.sectionId))].find((id) => !taken.has(id));
      const reply = await call('POST', '/api/timetables', {
        bearer: token(),
        body: { sectionId: section || target.sectionId, subjectId: target.subjectId, facultyId: freeTeacher.id, roomId: target.roomId, day: target.day, slot: target.slot }
      });
      return { ok: reply.status === 409 && /Room .* is already booked for/.test(reply.message), detail: `HTTP ${reply.status} - "${reply.message}"` };
    }
  },
  {
    owner: 'Raghav - Backend & security', id: 'TC18', title: 'Reject SQL-injection input (section parameter and login e-mail)',
    expect: 'Section parameter: 400 invalid format; login with an injection e-mail: 401, never a token',
    async run() {
      const section = await call('GET', `/api/timetables?section=${encodeURIComponent("CSE5' OR '1'='1")}`, { bearer: token() });
      const login = await call('POST', '/api/auth/login', { body: { email: "' OR '1'='1", password: 'Whatever1' } });
      return {
        ok: section.status === 400 && !section.data.entries && [400, 401].includes(login.status) && !login.data.token,
        detail: `section: HTTP ${section.status} - "${section.message}"; login: HTTP ${login.status} - "${login.message}"`
      };
    }
  },
  {
    owner: 'Raghav - Backend & security', id: 'TC19', title: 'Limit repeated failed login attempts',
    expect: 'Attempts 1-5: 401; attempt 6: 429 "Too many login attempts. Please try again in 15 minutes."',
    async run() {
      const email = `lockout.${Date.now()}@timora.edu`;
      const statuses = [];
      let last;
      for (let i = 0; i < 6; i += 1) {
        last = await call('POST', '/api/auth/login', { body: { email, password: 'Wrong-Pass1' } });
        statuses.push(last.status);
      }
      return { ok: statuses.join() === '401,401,401,401,401,429' && /Too many login attempts/.test(last.message), detail: `statuses ${statuses.join(', ')} - "${last.message}"` };
    }
  },
  {
    owner: 'Raghav - Backend & security', id: 'TC20', title: 'Health check reports the API and database as UP',
    expect: '200 with api UP and database UP',
    async run() {
      const reply = await call('GET', '/api/health');
      return { ok: reply.status === 200 && reply.data.api === 'UP' && reply.data.database === 'UP', detail: `HTTP ${reply.status} - api ${reply.data.api}, database ${reply.data.database}` };
    }
  }
];

const context = {
  studentEmail: () => document.getElementById('tc-student-email')?.value.trim() || 'student@timora.edu',
  studentPassword: () => document.getElementById('tc-student-password')?.value || 'Password123!'
};

async function runProbe(index) {
  const row = document.querySelector(`[data-probe="${index}"]`);
  const badge = row.querySelector('.tc-result');
  const detail = row.querySelector('.tc-detail');
  badge.textContent = 'Running...';
  badge.className = 'tc-result';
  let outcome;
  try {
    outcome = await PROBES[index].run(context);
  } catch (error) {
    outcome = { ok: false, detail: `Error: ${error.message}` };
  }
  badge.textContent = outcome.ok ? 'PASS' : 'FAIL';
  badge.className = `tc-result ${outcome.ok ? 'tc-pass' : 'tc-fail'}`;
  detail.textContent = outcome.detail;
  return outcome.ok;
}

function render() {
  const body = document.getElementById('testcases-body');
  if (!body) return;
  let owner = '';
  let html = `
    <div class="form-row tc-student">
      <div class="form-group col-4"><label for="tc-student-email">Student account for the role checks</label>
        <input id="tc-student-email" class="form-input" value="student@timora.edu" autocomplete="off"></div>
      <div class="form-group col-4"><label for="tc-student-password">Password</label>
        <input id="tc-student-password" type="password" class="form-input" value="Password123!" autocomplete="off"></div>
    </div>
    <div class="settings-actions"><button type="button" id="tc-run-all" class="btn btn-primary">Run all checks</button><span id="tc-summary" class="text-muted"></span></div>`;
  PROBES.forEach((probe, index) => {
    if (probe.owner !== owner) {
      owner = probe.owner;
      html += `<h4 class="tc-owner">${escapeHtml(owner)}</h4>`;
    }
    html += `
      <div class="tc-row" data-probe="${index}">
        <div class="tc-head"><strong>${escapeHtml(probe.id)}</strong> ${escapeHtml(probe.title)}</div>
        <div class="text-muted tc-expect">Expected: ${escapeHtml(probe.expect)}</div>
        <div class="tc-foot"><button type="button" class="btn btn-secondary btn-sm tc-run">Run</button><span class="tc-result"></span><span class="tc-detail text-muted"></span></div>
      </div>`;
  });
  body.innerHTML = html;
  body.querySelectorAll('.tc-run').forEach((button) =>
    button.addEventListener('click', () => runProbe(Number(button.closest('[data-probe]').dataset.probe)))
  );
  document.getElementById('tc-run-all').addEventListener('click', async () => {
    let passed = 0;
    for (let i = 0; i < PROBES.length; i += 1) if (await runProbe(i)) passed += 1;
    document.getElementById('tc-summary').textContent = ` ${passed} of ${PROBES.length} checks pass`;
  });
}

document.addEventListener('timora:open-testcases', render);
