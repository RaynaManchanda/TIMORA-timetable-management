/**
 * TIMORA - Frontend Application Controller
 * Person 3: Rohit (Frontend, Analytics & User Workflows)
 * Dynamic Academic Scheduling & Student-Day Optimization Platform
 */

// Application State
const state = {
  token: sessionStorage.getItem('timora_token') || null,
  user: JSON.parse(sessionStorage.getItem('timora_user') || 'null'),
  currentPage: 'dashboard',
  currentTab: 'subjects',
  activeVersion: null,
  versions: [],
  disruptions: [],
  faculty: [],
  rooms: [],
  sections: [],
  subjects: [],
  timeSlots: [],
  blocks: [],
  selectedAlternative: null,
  generatedDraftId: null,
  lastGeneratedResult: null,
  lastInterpretedAI: null,
  notifications: []
};

// ==============================================================================
// 1. API Client Helper with Token Injection
// ==============================================================================
async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && state.token && !data.connectionStatus) {
      endSession('timora:session-expired');
    }
    if (!res.ok) {
      const error = new Error(data.message || data.error || `HTTP ${res.status}`);
      error.data = data;
      throw error;
    }
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

/**
 * Escape text before it is placed into an HTML template. Everything that comes from the
 * database (names, reasons, messages) goes through this, so stored text can never run as markup.
 *
 * @param {unknown} value Text to show.
 * @returns {string}
 */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

const TEACHING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const isAdminUser = () => state.user && (state.user.role === 'COORDINATOR' || state.user.role === 'ADMIN');
const PAGE_ROLES = {
  dashboard: ['COORDINATOR', 'ADMIN'],
  generate: ['COORDINATOR', 'ADMIN'],
  disruptions: ['COORDINATOR', 'ADMIN'],
  'academic-data': ['COORDINATOR', 'ADMIN'],
  analytics: ['COORDINATOR', 'ADMIN'],
  'ai-assistant': ['COORDINATOR', 'ADMIN'],
  testcases: ['COORDINATOR', 'ADMIN'],
  timetable: ['COORDINATOR', 'ADMIN', 'FACULTY', 'STUDENT'],
  notifications: ['COORDINATOR', 'ADMIN', 'FACULTY', 'STUDENT'],
  settings: ['COORDINATOR', 'ADMIN', 'FACULTY', 'STUDENT']
};

// Toast Notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ==============================================================================
// 2. Authentication & Role Routing (TC01, TC17, TC18)
// ==============================================================================
/**
 * Store a new session after the sign-in screen reports a successful login,
 * then route the user to the page that matches their role (TC01).
 *
 * @param {{ token: string, user: object }} session Session returned by the login endpoint.
 */
function startSession({ token, user }) {
  state.token = token;
  state.user = user;
  sessionStorage.setItem('timora_token', token);
  sessionStorage.setItem('timora_user', JSON.stringify(user));

  document.getElementById('signin-modal').style.display = 'none';
  updateUserUI();
  showToast(`Signed in as ${user.name} (${user.role})`);

  // Coordinator routes to Dashboard; Faculty and Student route to Timetable
  if (user.role === 'COORDINATOR' || user.role === 'ADMIN') {
    navigateTo('dashboard');
  } else {
    navigateTo('timetable');
  }

  loadAllData();
}

/**
 * Clear the stored session and show the sign-in screen again.
 *
 * @param {'timora:signed-out' | 'timora:session-expired'} reason Event the sign-in screen uses to pick its message.
 */
function endSession(reason) {
  state.token = null;
  state.user = null;
  clearLoadedData();
  sessionStorage.removeItem('timora_token');
  sessionStorage.removeItem('timora_user');

  document.getElementById('signin-modal').style.display = 'flex';
  navigateTo('dashboard');
  window.dispatchEvent(new CustomEvent(reason));
}

/**
 * Forget all timetable data held in memory and wipe the views, so the next person using this
 * browser never sees the previous user's schedule.
 */
function clearLoadedData() {
  Object.assign(state, {
    activeVersion: null, versions: [], disruptions: [], faculty: [], rooms: [], sections: [], subjects: [],
    timeSlots: [], blocks: [], notifications: [], selectedAlternative: null, lastGeneratedResult: null,
    generatedDraftId: null, lastInterpretedAI: null
  });
  [
    'timetable-matrix-container', 'needs-attention-tbody', 'recent-activity-tbody', 'subjects-table-body',
    'faculty-table-body', 'rooms-table-body', 'sections-table-body', 'versions-tbody', 'notifications-list',
    'alternatives-grid', 'affected-classes-tbody', 'gen-preview-grid-container', 'cal-events-preview'
  ].forEach((id) => document.getElementById(id)?.replaceChildren());
  ['generation-results-card', 'disruption-impact-section', 'ai-validation-container'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
  });
  const badge = document.getElementById('nav-notif-badge');
  if (badge) badge.classList.remove('visible');
}

function initAuth() {
  const signinModal = document.getElementById('signin-modal');
  const btnSignout = document.getElementById('btn-signout');

  window.addEventListener('timora:authenticated', (event) => startSession(event.detail));

  // Handle Sign Out (TC17)
  if (btnSignout) {
    btnSignout.addEventListener('click', () => endSession('timora:signed-out'));
  }

  // Verify the stored session with the server before showing anything (the token may have
  // expired, or the account may have been disabled since the last visit).
  if (!state.token || !state.user) {
    if (signinModal) signinModal.style.display = 'flex';
  } else {
    api('/api/auth/me')
      .then((res) => {
        state.user = res.user;
        sessionStorage.setItem('timora_user', JSON.stringify(res.user));
        if (signinModal) signinModal.style.display = 'none';
        updateUserUI();
        navigateTo(isAdminUser() ? 'dashboard' : 'timetable');
        loadAllData();
      })
      .catch(() => {
        // A 401 already ended the session; any other failure also leaves the sign-in screen up.
        if (state.token) endSession('timora:session-expired');
        if (signinModal) signinModal.style.display = 'flex';
      });
  }

  initPasswordChange();
}

/**
 * Change-password dialog. A successful change revokes the old tokens on the server and
 * returns a fresh one, so this browser stays signed in.
 */
function initPasswordChange() {
  const modal = document.getElementById('password-modal');
  const form = document.getElementById('form-change-password');
  if (!modal || !form) return;

  const errorBox = document.getElementById('password-error');
  const close = () => {
    modal.style.display = 'none';
    form.reset();
    errorBox.style.display = 'none';
  };
  document.getElementById('btn-change-password')?.addEventListener('click', () => { modal.style.display = 'flex'; document.getElementById('pw-current').focus(); });
  document.getElementById('btn-close-password-modal')?.addEventListener('click', close);
  document.getElementById('btn-cancel-password')?.addEventListener('click', close);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentPassword = document.getElementById('pw-current').value;
    const newPassword = document.getElementById('pw-new').value;
    const showError = (text) => { errorBox.textContent = text; errorBox.style.display = 'block'; };

    if (newPassword !== document.getElementById('pw-confirm').value) return showError('The new passwords do not match.');

    try {
      const res = await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      state.token = res.token;
      sessionStorage.setItem('timora_token', res.token);
      close();
      showToast('Password changed. Other devices were signed out.');
    } catch (err) {
      showError(err.message);
    }
  });
}

function updateUserUI() {
  if (!state.user) return;
  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role');
  const avatarEl = document.getElementById('current-user-avatar');

  if (nameEl) nameEl.textContent = state.user.name;
  if (roleEl) roleEl.textContent = state.user.role;
  if (avatarEl) avatarEl.textContent = state.user.name.charAt(0).toUpperCase();

  // Enforce role-based menu visibility
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    const roles = (item.dataset.roles || '').split(',');
    const isAllowed = roles.includes(state.user.role) || (state.user.role === 'COORDINATOR' && roles.includes('ADMIN'));
    item.style.display = isAllowed ? 'flex' : 'none';
  });
}

// ==============================================================================
// 3. Navigation & Page Switching
// ==============================================================================
function navigateTo(pageId) {
  // A page the signed-in role may not use falls back to the timetable (the server refuses the data anyway).
  if (state.user && PAGE_ROLES[pageId] && !PAGE_ROLES[pageId].includes(state.user.role)) {
    pageId = 'timetable';
  }
  state.currentPage = pageId;

  // Update sidebar active link
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.page === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update page title
  const pageTitles = {
    'dashboard': 'Dashboard',
    'timetable': 'Timetable',
    'generate': 'Generate Timetable',
    'disruptions': 'Disruptions & Adaptive Rescheduling',
    'academic-data': 'Academic Data Management',
    'analytics': 'Versions & Quality Analytics',
    'ai-assistant': 'AI Constraint Assistant',
    'testcases': 'Test console',
    'notifications': 'Schedule Notifications',
    'settings': 'Settings'
  };

  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = pageTitles[pageId] || 'TIMORA';

  // Toggle page views
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  const activeView = document.getElementById(`view-${pageId}`);
  if (activeView) activeView.classList.add('active');

  // Trigger page-specific refreshes
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'timetable') renderTimetable();
  if (pageId === 'academic-data') renderAcademicData();
  if (pageId === 'analytics') renderAnalytics();
  if (pageId === 'notifications') renderNotifications();
  if (pageId === 'settings') renderSettings();
  if (pageId === 'testcases') document.dispatchEvent(new CustomEvent('timora:open-testcases'));
}

// ==============================================================================
// 4. Data Loading
// ==============================================================================
async function loadAllData() {
  try {
    // 1. Load Metadata
    const meta = await api('/api/rescheduling/metadata');
    if (meta.success) {
      state.faculty = meta.faculty || [];
      state.rooms = meta.rooms || [];
      state.sections = meta.sections || [];
      state.subjects = meta.subjects || [];
      state.timeSlots = meta.timeSlots || [];
      state.blocks = meta.blocks || [];
      populateSectionSelects();
      populateSlotSelect();
    }

    // 2. Load Versions
    const verRes = await api('/api/rescheduling/versions');
    if (verRes.success) {
      state.versions = verRes.versions || [];
      state.activeVersion = verRes.activeVersion || state.versions[0];
      const headerVer = document.getElementById('header-active-version');
      if (headerVer && state.activeVersion) {
        headerVer.textContent = state.activeVersion.versionNumber;
      }
    }

    // 3. Load Disruptions (administrators only; everyone else is refused by the server)
    if (isAdminUser()) {
      const disRes = await api('/api/rescheduling/disruptions');
      if (disRes.success) {
        state.disruptions = disRes.disruptions || [];
      }
    }

    // 4. Load Notifications
    loadNotifications();

    // Populate Disruption Form dropdowns
    populateDisruptionDropdowns();
    resumeGoogleConnection();

    // Render active view
    navigateTo(state.currentPage);
  } catch (err) {
    console.error('Error loading application data:', err);
  }
}

// ==============================================================================
// 5. Dashboard View (TC02)
// ==============================================================================
function renderDashboard() {
  const activeEntries = (state.activeVersion && state.activeVersion.entries) || [];
  const metrics = state.activeVersion && state.activeVersion.metrics;
  const openDisruptions = state.disruptions.filter(d => d.status === 'RECORDED' || d.status === 'ANALYZED');

  // Summary cards (TC02): figures are computed by the server from the active timetable
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
  setText('dash-quality-score', metrics ? metrics.qualityScore : '-');
  setText('dash-avoidable-gaps', metrics ? metrics.avoidableGaps : '-');
  setText('dash-scheduled-classes', activeEntries.length);
  setText('dash-open-disruptions', openDisruptions.length);

  // Needs Attention Table
  const needsTbody = document.getElementById('needs-attention-tbody');
  const needsBadge = document.getElementById('needs-attention-badge');
  if (needsTbody) {
    needsTbody.innerHTML = '';
    if (openDisruptions.length === 0) {
      needsTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No pending disruption events. Schedule is running smoothly.</td></tr>`;
      if (needsBadge) needsBadge.textContent = '0 Pending';
    } else {
      if (needsBadge) needsBadge.textContent = `${openDisruptions.length} Pending`;
      openDisruptions.forEach(dis => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${esc((dis.disruptionType || dis.type || '').replace(/_/g, ' '))}</strong><br><small class="text-muted">${esc(dis.reason || 'Leave')}</small></td>
          <td>${esc(entityName(dis))}</td>
          <td>${esc(dis.dayOfWeek)} (${esc(dis.slotId || 'All Day')})</td>
          <td><button class="btn btn-primary btn-sm btn-action-reschedule" data-disruption-id="${esc(dis.id)}">Analyze Impact</button></td>
        `;
        needsTbody.appendChild(tr);
      });
    }
  }

  // Recent Activity: the latest timetable versions and reported disruptions
  const activityTbody = document.getElementById('recent-activity-tbody');
  if (activityTbody) {
    const activities = [
      ...state.versions.filter(v => v.status !== 'DRAFT').slice(0, 4).map(v => ({
        activity: v.status === 'ACTIVE' ? 'Timetable Active' : 'Timetable Version',
        details: `${v.versionNumber} - ${v.name}`,
        user: v.approvedBy || '-',
        at: v.createdAt
      })),
      ...state.disruptions.slice(0, 4).map(d => ({
        activity: 'Disruption ' + d.status.toLowerCase(),
        details: `${(d.disruptionType || '').replace(/_/g, ' ')} - ${entityName(d)} (${d.dayOfWeek})`,
        user: d.reportedBy || '-',
        at: d.createdAt
      }))
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);

    activityTbody.innerHTML = activities.length === 0
      ? `<tr><td colspan="4" class="text-center text-muted">No activity yet.</td></tr>`
      : activities.map(a => `
        <tr>
          <td><strong>${esc(a.activity)}</strong></td>
          <td>${esc(a.details)}</td>
          <td>${esc(a.user)}</td>
          <td class="text-muted">${esc(new Date(a.at).toLocaleString())}</td>
        </tr>`).join('');
  }

  // Attach click listener for Reschedule buttons in Needs Attention
  document.querySelectorAll('.btn-action-reschedule').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo('disruptions');
      triggerImpactAnalysis(btn.dataset.disruptionId);
    });
  });
}

/**
 * Human-readable name of whatever a disruption concerns (teacher, room, section).
 *
 * @param {object} disruption Disruption record.
 * @returns {string}
 */
function entityName(disruption) {
  if (disruption.affectedEntityName) return disruption.affectedEntityName;
  const id = disruption.affectedEntityId;
  const found = [...state.faculty, ...state.rooms, ...state.sections].find(item => item.id === id);
  return found ? found.name : id;
}

// ==============================================================================
// 6. Timetable View (TC03, TC04, TC05, TC06)
// ==============================================================================
/**
 * Fill the section pickers from the sections stored in the database.
 */
function populateSectionSelects() {
  const sections = [...state.sections].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const options = sections.map(sec => `<option value="${esc(sec.id)}">${esc(sec.name)}${sec.batch ? ` (${esc(sec.batch)} batch)` : ''}</option>`).join('');

  const ttSelect = document.getElementById('tt-filter-section');
  if (ttSelect) {
    const previous = ttSelect.value;
    ttSelect.innerHTML = options;
    ttSelect.value = sections.some(sec => sec.id === previous) ? previous : (sections.find(sec => sec.name === 'CSE V') || sections[0] || {}).id || '';
  }

  const genSelect = document.getElementById('gen-section-select');
  if (genSelect) {
    const previous = genSelect.value;
    genSelect.innerHTML = `<option value="">All Active Sections</option>${options}`;
    genSelect.value = sections.some(sec => sec.id === previous) ? previous : '';
  }
}

/**
 * Fill the time-slot picker of the disruption form from the teaching hours.
 */
function populateSlotSelect() {
  const slotSelect = document.getElementById('dis-slot');
  if (!slotSelect || state.timeSlots.length === 0) return;
  const previous = slotSelect.value || 'S2';
  slotSelect.innerHTML = `<option value="">Full Day</option>` +
    state.timeSlots.map(slot => `<option value="${esc(slot.id)}">Slot ${esc(slot.id)} (${esc(slot.label)})</option>`).join('');
  slotSelect.value = previous;
}

const BLOCK_LABELS = {
  LUNCH: 'Lunch',
  MENTORING: 'DSW / ECC-II / Mentor meeting',
  MINOR: 'Minor programme',
  INDUSTRY_EXPERT: 'Industry expert session',
  OTHER: 'Reserved'
};

function renderTimetable() {
  const container = document.getElementById('timetable-matrix-container');
  if (!container) return;

  const user = state.user;
  const isStudent = user && user.role === 'STUDENT';
  const isFaculty = user && user.role === 'FACULTY';

  const sectionSelect = document.getElementById('tt-filter-section');
  const viewSelect = document.getElementById('tt-view-selector');
  const dayGroup = document.getElementById('tt-day-group');
  const daySelect = document.getElementById('tt-filter-day');

  // Students always see their own section and faculty their own classes; only administrators choose.
  const sectionGroup = sectionSelect && sectionSelect.closest('.control-group');
  if (sectionGroup) sectionGroup.style.display = (isStudent || isFaculty) ? 'none' : '';

  const selectedSection = isStudent ? user.sectionId : (sectionSelect ? sectionSelect.value : '');
  const selectedView = viewSelect ? viewSelect.value : 'WEEK';
  const selectedDay = daySelect ? daySelect.value : 'Monday';

  if (dayGroup) {
    dayGroup.style.display = selectedView === 'TODAY' ? 'flex' : 'none';
  }

  // On a phone the week does not fit: show one day at a time, chosen with day chips.
  const isPhone = window.matchMedia('(max-width: 640px)').matches;
  if (!state.ttPhoneDay) {
    const today = new Date().getDay();
    state.ttPhoneDay = today >= 1 && today <= 5 ? TEACHING_DAYS[today - 1] : TEACHING_DAYS[0];
  }
  const showChips = isPhone && selectedView === 'WEEK';
  const days = selectedView === 'TODAY' ? [selectedDay] : showChips ? [state.ttPhoneDay] : TEACHING_DAYS;
  const slots = state.timeSlots && state.timeSlots.length > 0 ? state.timeSlots : [];
  const activeEntries = (state.activeVersion && state.activeVersion.entries) || [];

  if (slots.length === 0 || (!isFaculty && !selectedSection)) {
    container.innerHTML = `<div class="p-4 text-center text-muted">No timetable has been loaded yet.</div>`;
    return;
  }

  // A section attends its own classes and the combined classes it shares with other sections.
  const attends = (entry) => entry.sectionId === selectedSection || (entry.coSectionIds || []).includes(selectedSection);
  const entries = activeEntries.filter(entry => (isFaculty ? entry.facultyId === user.facultyId : attends(entry)));
  const blocks = isFaculty ? [] : state.blocks.filter(block => block.sectionId === selectedSection);
  const sectionName = (id) => (state.sections.find(sec => sec.id === id) || {}).name || id;

  const caption = isFaculty
    ? `Your classes - ${esc(user.name)}`
    : `${esc(sectionName(selectedSection))} - ${entries.length} classes a week`;

  let html = `<div class="tt-caption">${caption}</div>`;
  html += `<table class="timetable-grid"><thead><tr><th class="time-col">Time Slot</th>`;
  days.forEach(day => {
    html += `<th>${esc(day)}</th>`;
  });
  html += `</tr></thead><tbody>`;

  slots.forEach(slot => {
    html += `<tr><td class="time-cell">${esc(slot.label)}</td>`;
    days.forEach(day => {
      const dayKey = day.toLowerCase();
      const cellEntries = entries.filter(e => e.dayOfWeek.toLowerCase() === dayKey && e.slotId === slot.id);
      const cellBlocks = blocks.filter(b => b.day.toLowerCase() === dayKey && b.slotId === slot.id);

      if (cellEntries.length === 0 && cellBlocks.length === 0) {
        html += `<td><div class="tt-slot-empty">Free Period</div></td>`;
        return;
      }

      const blockHtml = cellBlocks.map(b => `
        <div class="tt-block tt-block-${esc(b.kind.toLowerCase())}" title="${esc(b.label)}">${esc(BLOCK_LABELS[b.kind] || b.label)}</div>`).join('');

      const isParallel = cellEntries.length > 1;
      const entryHtml = cellEntries.map(entry => {
        const sub = state.subjects.find(s => s.id === entry.subjectId);
        const fac = state.faculty.find(f => f.id === entry.facultyId);
        const rm = state.rooms.find(r => r.id === entry.roomId);
        const isLab = entry.sessionType === 'LAB' || (sub && sub.type === 'LAB');
        const others = [entry.sectionId, ...(entry.coSectionIds || [])].filter(id => id !== selectedSection);
        const combined = entry.coSectionIds && entry.coSectionIds.length > 0;
        const classes = ['tt-slot-card', isLab ? 'lab-card' : '', entry.isElective ? 'elective-card' : '', combined ? 'combined-card' : ''].join(' ');
        const title = sub ? `${sub.code} - ${sub.name}` : entry.subjectId;

        return `
          <div class="${classes}" title="${esc(title)}">
            <div class="tt-slot-subject">${esc(sub ? (sub.abbreviation || sub.name) : entry.subjectId)}${isLab ? ' <span class="tt-tag">Lab</span>' : ''}</div>
            <div class="tt-slot-faculty">${esc(fac ? fac.name : entry.facultyId)}</div>
            <div class="tt-slot-room"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>${esc(rm ? rm.name : entry.roomId)}</div>
            ${isFaculty ? `<div class="tt-slot-sections">${esc([entry.sectionId, ...(entry.coSectionIds || [])].map(sectionName).join(', '))}</div>` : ''}
            ${(!isFaculty && combined) ? `<div class="tt-slot-sections">with ${esc(others.map(sectionName).join(', '))}</div>` : ''}
          </div>`;
      }).join('');

      html += `<td><div class="tt-cell${isParallel ? ' tt-parallel' : ''}">${blockHtml}${isParallel ? `<div class="tt-parallel-note">Pick one of ${cellEntries.length}</div>` : ''}${entryHtml}</div></td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  if (showChips) {
    const chips = TEACHING_DAYS.map(day => `
      <button type="button" class="tt-day-chip${day === state.ttPhoneDay ? ' active' : ''}" role="tab" aria-selected="${day === state.ttPhoneDay}" data-day="${esc(day)}">${esc(day.slice(0, 3))}</button>`).join('');
    html = `<div class="tt-day-chips" role="tablist" aria-label="Day of the week">${chips}</div>` + html;
  }
  container.innerHTML = html;

  container.querySelectorAll('.tt-day-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.ttPhoneDay = chip.dataset.day;
      renderTimetable();
    });
  });
}

// Print Timetable (TC05)
function initPrintAction() {
  const btnPrint = document.getElementById('btn-print-timetable');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }
}

// Google Calendar Sync Modal & Action (TC06, TC16, TC17)
function initGoogleCalendarActions() {
  const btnSync = document.getElementById('btn-sync-gcal');
  const quickSync = document.getElementById('header-btn-quick-sync');
  const modal = document.getElementById('calendar-sync-modal');
  const btnClose = document.getElementById('btn-close-cal-modal');
  const btnDone = document.getElementById('btn-close-cal-done');
  const btnTrigger = document.getElementById('btn-trigger-gcal-sync');

  const openModal = async () => {
    if (modal) modal.style.display = 'flex';
    try {
      const query = isAdminUser() ? `?sectionId=${encodeURIComponent(document.getElementById('tt-filter-section')?.value || '')}` : '';
      const res = await api(`/api/calendar/events${query}`);
      const previewEl = document.getElementById('cal-events-preview');
      if (previewEl && res.events) {
        previewEl.innerHTML = `<h5 class="mb-2">Prepared ${esc(res.count)} Recurring Weekly Events (${esc(res.timeZone)})</h5>` +
          res.events.slice(0, 5).map(ev => `
            <div class="p-2 border-bottom small">
              <strong>${esc(ev.summary)}</strong> &bull; ${esc(ev.location)}<br>
              <span class="text-muted">${esc(ev.recurrence[0])} (${esc(ev.start.timeZone)})</span>
            </div>
          `).join('') + (res.count > 5 ? `<p class="small text-muted mt-2">+ ${res.count - 5} more events...</p>` : '');
      }
    } catch (err) {
      console.warn('Calendar events preview error:', err);
    }
  };

  if (btnSync) btnSync.addEventListener('click', openModal);
  if (quickSync) quickSync.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', () => modal.style.display = 'none');
  if (btnDone) btnDone.addEventListener('click', () => modal.style.display = 'none');

  if (btnTrigger) {
    btnTrigger.addEventListener('click', async () => {
      const desc = document.getElementById('cal-sync-desc');
      const idleLabel = btnTrigger.textContent;
      btnTrigger.disabled = true;
      btnTrigger.textContent = 'Syncing...';
      if (desc) desc.textContent = 'Sending your timetable to Google Calendar. This can take up to a minute...';
      try {
        const res = await api('/api/calendar/sync', { method: 'POST', body: JSON.stringify(calendarSyncBody('tt-filter-section')) });
        if (desc) desc.textContent = res.message;
        showToast(res.message);
      } catch (err) {
        if (desc) desc.textContent = err.message;
        handleCalendarError(err);
      } finally {
        btnTrigger.disabled = false;
        btnTrigger.textContent = idleLabel;
      }
    });
  }
}

/**
 * A failed sync because Google is not connected (or must be reconnected) sends the user to Settings.
 *
 * @param {Error & { data?: object }} err Error from the API helper.
 */
/**
 * Students and faculty sync their own timetable; an administrator syncs the section chosen in the picker.
 *
 * @param {string} selectId Id of the section picker to read.
 * @returns {{ sectionId?: string }}
 */
function calendarSyncBody(selectId) {
  return isAdminUser() ? { sectionId: document.getElementById(selectId)?.value } : {};
}

function handleCalendarError(err) {
  showToast(err.message, 'error');
  if (err.data && err.data.connectionStatus) {
    const modal = document.getElementById('calendar-sync-modal');
    if (modal) modal.style.display = 'none';
    navigateTo('settings');
  }
}

// ==============================================================================
// Settings: Google Calendar connection and account
// ==============================================================================
async function renderSettings() {
  const user = state.user;
  if (!user) return;
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText('settings-name', user.name);
  setText('settings-email', user.email);
  setText('settings-role', user.role);

  let status;
  try {
    status = await api('/api/calendar/status');
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  const connected = status.connected && status.authStatus === 'ACTIVE';
  const needsReconnect = status.connected && status.authStatus === 'REAUTH_REQUIRED';
  const badge = document.getElementById('gcal-status-badge');
  badge.textContent = connected ? 'Connected' : needsReconnect ? 'Reconnect needed' : 'Not connected';
  badge.className = `badge ${connected ? 'badge-success' : needsReconnect ? 'badge-warning' : 'badge-neutral'}`;

  setText('gcal-account', status.googleAccountEmail || (status.connected ? 'Connected' : 'Not connected'));
  setText('gcal-last-synced', status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : 'Never');
  setText('gcal-events-count', String(status.eventsCount));

  const warning = document.getElementById('gcal-not-configured');
  warning.style.display = status.configured ? 'none' : 'block';
  warning.textContent = status.configured ? '' :
    'Google Calendar is not configured on the server. Ask the administrator to set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI in the server .env file and restart (see README, "Google Calendar").';

  loadElectives();

  const sectionRow = document.getElementById('gcal-section-row');
  if (sectionRow) {
    sectionRow.style.display = isAdminUser() ? '' : 'none';
    const select = document.getElementById('gcal-section');
    if (select && select.options.length === 0) {
      select.innerHTML = state.sections.map(sec => `<option value="${esc(sec.id)}">${esc(sec.name)}</option>`).join('');
      select.value = (state.sections.find(sec => sec.name === 'CSE V') || state.sections[0] || {}).id || '';
    }
  }

  const connectButton = document.getElementById('btn-gcal-connect');
  connectButton.textContent = needsReconnect ? 'Reconnect Google Calendar' : connected ? 'Connect another account' : 'Connect Google Calendar';
  connectButton.disabled = !status.configured;
  document.getElementById('btn-gcal-sync').disabled = !connected;
  document.getElementById('btn-gcal-disconnect').disabled = !status.connected;
}

/**
 * Students tick the elective classes they attend; only those are synced to the calendar.
 */
async function loadElectives() {
  const card = document.getElementById('electives-card');
  if (!card) return;
  if (!state.user || state.user.role !== 'STUDENT') {
    card.style.display = 'none';
    return;
  }
  try {
    const { options, selected } = await api('/api/calendar/electives');
    card.style.display = options.length > 0 ? '' : 'none';
    document.getElementById('electives-options').innerHTML = options.map(o => `
      <label><input type="checkbox" name="elective" value="${esc(o.subjectId)}" ${selected.includes(o.subjectId) ? 'checked' : ''}>
      <span><strong>${esc(o.code)}</strong> ${esc(o.name)}</span></label>`).join('');
  } catch (err) {
    console.warn('Could not load electives:', err.message);
  }
}

function initSettings() {
  document.getElementById('btn-save-electives')?.addEventListener('click', async () => {
    const subjectIds = [...document.querySelectorAll('#electives-options input:checked')].map(box => box.value);
    try {
      const res = await api('/api/calendar/electives', { method: 'PUT', body: JSON.stringify({ subjectIds }) });
      showToast(`${res.message} Sync your calendar to apply it.`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-gcal-connect')?.addEventListener('click', async () => {
    try {
      const res = await api('/api/calendar/connect', { method: 'POST', body: JSON.stringify({}) });
      window.location.assign(res.url); // Google's consent screen
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-gcal-sync')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Syncing...';
    try {
      const res = await api('/api/calendar/sync', { method: 'POST', body: JSON.stringify(calendarSyncBody('gcal-section')) });
      showToast(res.message);
    } catch (err) {
      handleCalendarError(err);
    }
    button.textContent = 'Sync now';
    renderSettings();
  });

  document.getElementById('btn-gcal-disconnect')?.addEventListener('click', async () => {
    if (!confirm('Disconnect Google Calendar? Events already copied stay in your calendar.')) return;
    try {
      await api('/api/calendar/disconnect', { method: 'POST', body: JSON.stringify({}) });
      showToast('Google Calendar disconnected.');
    } catch (err) {
      showToast(err.message, 'error');
    }
    renderSettings();
  });

  document.getElementById('btn-settings-password')?.addEventListener('click', () => document.getElementById('btn-change-password')?.click());

  document.getElementById('btn-settings-logout-all')?.addEventListener('click', async () => {
    if (!confirm('Sign out of every device, including this one?')) return;
    try {
      await api('/api/auth/logout-all', { method: 'POST', body: JSON.stringify({}) });
    } catch (err) {
      console.warn(err);
    }
    endSession('timora:signed-out');
  });
}

/**
 * Google sends the browser back to the app as "/?code=...&state=...". Keep those values for the
 * signed-in session (removing them from the address bar), then finish the connection.
 */
function captureGoogleReturn() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get('state') || !(params.get('code') || params.get('error'))) return;
  sessionStorage.setItem('timora_gcal_return', JSON.stringify({
    code: params.get('code'), state: params.get('state'), error: params.get('error')
  }));
  window.history.replaceState({}, '', window.location.pathname);
}

async function resumeGoogleConnection() {
  const raw = sessionStorage.getItem('timora_gcal_return');
  if (!raw || !state.token) return;
  sessionStorage.removeItem('timora_gcal_return');

  const { code, state: oauthState, error } = JSON.parse(raw);
  navigateTo('settings');
  if (error) {
    showToast(error === 'access_denied' ? 'Google access was not granted.' : `Google returned an error: ${error}`, 'error');
    return;
  }
  try {
    const res = await api('/api/calendar/connect/complete', { method: 'POST', body: JSON.stringify({ code, state: oauthState }) });
    showToast(res.googleAccountEmail ? `Google Calendar connected (${res.googleAccountEmail}).` : res.message);
  } catch (err) {
    showToast(err.message, 'error');
  }
  renderSettings();
}

// ==============================================================================
// 7. Academic Data Management (TC07, TC08)
// ==============================================================================
function initAcademicTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabName = btn.dataset.tab;
      state.currentTab = tabName;

      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const activePane = document.getElementById(`tab-content-${tabName}`);
      if (activePane) activePane.classList.add('active');
    });
  });

  // Add Record Modal
  const btnOpenAdd = document.getElementById('btn-open-add-record-modal');
  const addModal = document.getElementById('add-record-modal');
  const btnCloseModal = document.getElementById('btn-close-record-modal');
  const btnCancelModal = document.getElementById('btn-cancel-add-record');
  const formAddRecord = document.getElementById('form-add-record');

  if (btnOpenAdd) {
    btnOpenAdd.addEventListener('click', () => {
      openAddRecordModal(state.currentTab);
    });
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', () => addModal.style.display = 'none');
  if (btnCancelModal) btnCancelModal.addEventListener('click', () => addModal.style.display = 'none');

  if (formAddRecord) {
    formAddRecord.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitNewRecord();
    });
  }
}

function openAddRecordModal(tab) {
  const modal = document.getElementById('add-record-modal');
  const title = document.getElementById('add-record-title');
  const fields = document.getElementById('add-record-form-fields');
  if (!modal || !fields) return;

  modal.style.display = 'flex';
  title.textContent = `Add New ${tab.charAt(0).toUpperCase() + tab.slice(1, -1)}`;

  if (tab === 'subjects') {
    fields.innerHTML = `
      <div class="form-group"><label>Subject Code</label><input type="text" id="rec-code" class="form-input" required placeholder="e.g. CS504"></div>
      <div class="form-group mt-2"><label>Subject Name</label><input type="text" id="rec-name" class="form-input" required placeholder="e.g. Computer Graphics"></div>
      <div class="form-group mt-2"><label>Type</label><select id="rec-type" class="form-select"><option value="LECTURE">LECTURE</option><option value="LAB">LAB</option></select></div>
      <div class="form-group mt-2"><label>Weekly Hours</label><input type="number" id="rec-hours" class="form-input" value="3" min="1" max="6"></div>
      <div class="form-group mt-2"><label>Credits</label><input type="number" id="rec-credits" class="form-input" value="3" min="1" max="5"></div>
    `;
  } else if (tab === 'faculty') {
    fields.innerHTML = `
      <div class="form-group"><label>Faculty Name</label><input type="text" id="rec-name" class="form-input" required placeholder="e.g. Dr. John von Neumann"></div>
      <div class="form-group mt-2"><label>Email Address</label><input type="email" id="rec-email" class="form-input" required placeholder="e.g. neumann@univ.edu"></div>
      <div class="form-group mt-2"><label>Department</label><input type="text" id="rec-dept" class="form-input" value="Computer Science"></div>
      <div class="form-group mt-2"><label>Max Hours / Week</label><input type="number" id="rec-hours" class="form-input" value="18" min="6" max="24"></div>
    `;
  } else if (tab === 'rooms') {
    fields.innerHTML = `
      <div class="form-group"><label>Room / Hall Name</label><input type="text" id="rec-name" class="form-input" required placeholder="e.g. Seminar Hall B"></div>
      <div class="form-group mt-2"><label>Building</label><input type="text" id="rec-bldg" class="form-input" value="Tech Block"></div>
      <div class="form-group mt-2"><label>Capacity</label><input type="number" id="rec-cap" class="form-input" value="60" min="20" max="200"></div>
      <div class="form-group mt-2"><label>Type</label><select id="rec-type" class="form-select"><option value="CLASSROOM">CLASSROOM</option><option value="LAB">LAB</option></select></div>
    `;
  } else if (tab === 'sections') {
    fields.innerHTML = `
      <div class="form-group"><label>Section Name</label><input type="text" id="rec-name" class="form-input" required placeholder="e.g. CSE 5th Sem - Sec C"></div>
      <div class="form-group mt-2"><label>Program</label><input type="text" id="rec-prog" class="form-input" value="B.Tech CSE"></div>
      <div class="form-group mt-2"><label>Semester</label><input type="number" id="rec-sem" class="form-input" value="5" min="1" max="8"></div>
      <div class="form-group mt-2"><label>Student Count</label><input type="number" id="rec-count" class="form-input" value="50" min="10" max="120"></div>
    `;
  }
}

async function submitNewRecord() {
  const tab = state.currentTab;
  const modal = document.getElementById('add-record-modal');

  try {
    let payload = {};
    if (tab === 'subjects') {
      payload = {
        code: document.getElementById('rec-code').value,
        name: document.getElementById('rec-name').value,
        type: document.getElementById('rec-type').value,
        requiredHoursPerWeek: document.getElementById('rec-hours').value,
        credits: document.getElementById('rec-credits').value
      };
    } else if (tab === 'faculty') {
      payload = {
        name: document.getElementById('rec-name').value,
        email: document.getElementById('rec-email').value,
        department: document.getElementById('rec-dept').value,
        maxHoursPerWeek: document.getElementById('rec-hours').value
      };
    } else if (tab === 'rooms') {
      payload = {
        name: document.getElementById('rec-name').value,
        building: document.getElementById('rec-bldg').value,
        capacity: document.getElementById('rec-cap').value,
        type: document.getElementById('rec-type').value
      };
    } else if (tab === 'sections') {
      payload = {
        name: document.getElementById('rec-name').value,
        program: document.getElementById('rec-prog').value,
        semester: document.getElementById('rec-sem').value,
        studentCount: document.getElementById('rec-count').value
      };
    }

    const res = await api(`/api/academic/${tab}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showToast(res.message || 'Record created successfully.');
    modal.style.display = 'none';

    // Refresh data and re-render
    const meta = await api('/api/rescheduling/metadata');
    if (meta.success) {
      state[tab] = meta[tab] || [];
      renderAcademicData();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderAcademicData() {
  const badge = (type) => `<span class="badge ${type === 'LAB' ? 'badge-info' : 'badge-neutral'}">${esc(type)}</span>`;
  const deleteButton = (type, id) => `<button class="btn btn-ghost btn-sm btn-del-record" data-type="${type}" data-id="${esc(id)}">Delete</button>`;

  // Render Subjects
  const subTbody = document.getElementById('subjects-table-body');
  if (subTbody) {
    subTbody.innerHTML = state.subjects.map(s => `
      <tr>
        <td><strong>${esc(s.code)}</strong></td>
        <td>${esc(s.name)}${s.abbreviation ? ` <small class="text-muted">(${esc(s.abbreviation)})</small>` : ''}</td>
        <td>${badge(s.type)}</td>
        <td>${esc(s.requiredHoursPerWeek || 3)} h${s.ldp ? ` <small class="text-muted">(${esc(s.ldp)})</small>` : ''}</td>
        <td>${esc(s.credits ?? 3)}</td>
        <td>${deleteButton('subjects', s.id)}</td>
      </tr>
    `).join('');
  }

  // Render Faculty
  const facTbody = document.getElementById('faculty-table-body');
  if (facTbody) {
    facTbody.innerHTML = state.faculty.map(f => `
      <tr>
        <td><strong>${esc(f.id)}</strong></td>
        <td>${esc(f.name)}</td>
        <td>${f.email ? esc(f.email) : '-'}</td>
        <td>${esc(f.department)}</td>
        <td>${esc(f.maxHoursPerWeek || 18)} h</td>
        <td>${deleteButton('faculty', f.id)}</td>
      </tr>
    `).join('');
  }

  // Render Rooms
  const rmTbody = document.getElementById('rooms-table-body');
  if (rmTbody) {
    rmTbody.innerHTML = state.rooms.map(r => `
      <tr>
        <td><strong>${esc(r.id)}</strong></td>
        <td>${esc(r.name)}${r.isShared ? ' <small class="text-muted">(shared)</small>' : ''}</td>
        <td>${esc(r.building)}</td>
        <td>${esc(r.capacity)} seats</td>
        <td>${badge(r.type)}</td>
        <td>${deleteButton('rooms', r.id)}</td>
      </tr>
    `).join('');
  }

  // Render Sections
  const secTbody = document.getElementById('sections-table-body');
  if (secTbody) {
    secTbody.innerHTML = state.sections.map(s => `
      <tr>
        <td><strong>${esc(s.id)}</strong></td>
        <td>${esc(s.name)}</td>
        <td>${esc(s.program)}</td>
        <td>Semester ${esc(s.semester)}</td>
        <td>${esc(s.studentCount)} students</td>
      </tr>
    `).join('');
  }

  // Attach delete handlers
  document.querySelectorAll('.btn-del-record').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.type;
      const id = btn.dataset.id;
      if (confirm(`Are you sure you want to delete this record?`)) {
        try {
          await api(`/api/academic/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' });
          showToast('Record deleted.');
          loadAllData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

// ==============================================================================
// 8. Timetable Generation View (TC12, TC13, TC14)
// ==============================================================================
function initGenerationEngine() {
  const form = document.getElementById('form-generate-timetable');
  const resultsCard = document.getElementById('generation-results-card');
  const btnApprovePublish = document.getElementById('btn-approve-publish');
  const btnRejectDraft = document.getElementById('btn-reject-draft');
  const btnRun = document.getElementById('btn-run-generation');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sectionId = document.getElementById('gen-section-select').value;
      const maxGap = document.getElementById('gen-max-gap').value;
      const mandatoryBreak = document.getElementById('gen-mandatory-break').value === 'true';

      if (btnRun) btnRun.disabled = true;
      try {
        // A previous, unpublished draft is thrown away so drafts never pile up.
        await discardCurrentDraft();

        const res = await api('/api/admin/timetables/generate', {
          method: 'POST',
          body: JSON.stringify({
            sectionId: sectionId || undefined,
            maxGapHours: Number(maxGap),
            mandatoryBreak,
            studentCount: document.getElementById('gen-student-count')?.value || undefined
          })
        });

        state.lastGeneratedResult = res;
        state.generatedDraftId = res.draftVersionId;

        // Display results (TC13): figures come from the engine, not from fixed text
        const metrics = res.metrics || {};
        resultsCard.style.display = 'block';
        document.getElementById('gen-quality-score').textContent = String(metrics.normalizedScore ?? '-');
        document.getElementById('gen-avoidable-gaps').textContent = String(metrics.avoidableGaps ?? '-');
        document.getElementById('gen-conflicts').textContent = String(metrics.hardConstraintConflicts ?? 0);
        document.getElementById('gen-longest-day').textContent = `${metrics.longestDay ?? '-'} h`;

        renderPreviewGrid(res.entries);
        showToast(`Draft ready: ${res.entriesCount} classes planned, ${metrics.hardConstraintConflicts ?? 0} conflicts. Review it, then publish or discard.`);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (btnRun) btnRun.disabled = false;
      }
    });
  }

  // Approve and publish (TC14): the draft stored on the server becomes the active timetable
  if (btnApprovePublish) {
    btnApprovePublish.addEventListener('click', async () => {
      if (!state.generatedDraftId) return;
      btnApprovePublish.disabled = true;
      try {
        const res = await api(`/api/admin/timetables/drafts/${encodeURIComponent(state.generatedDraftId)}/publish`, { method: 'POST' });
        showToast(`Published as ${res.version.versionNumber}`);
        resultsCard.style.display = 'none';
        state.generatedDraftId = null;
        state.lastGeneratedResult = null;
        loadAllData();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnApprovePublish.disabled = false;
      }
    });
  }

  // Reject draft (TC14): the draft is deleted on the server
  if (btnRejectDraft) {
    btnRejectDraft.addEventListener('click', async () => {
      await discardCurrentDraft();
      resultsCard.style.display = 'none';
      showToast('Draft rejected.');
    });
  }
}

/**
 * Delete the draft that is currently on screen, if any.
 */
async function discardCurrentDraft() {
  const draftId = state.generatedDraftId;
  state.generatedDraftId = null;
  state.lastGeneratedResult = null;
  if (!draftId) return;
  try {
    await api(`/api/admin/timetables/drafts/${encodeURIComponent(draftId)}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Could not discard draft:', err.message);
  }
}

function renderPreviewGrid(entries) {
  const container = document.getElementById('gen-preview-grid-container');
  if (!container) return;
  const shown = [...entries].sort((a, b) => TEACHING_DAYS.indexOf(a.dayOfWeek) - TEACHING_DAYS.indexOf(b.dayOfWeek) || a.slotId.localeCompare(b.slotId)).slice(0, 12);
  container.innerHTML = `
    <div class="alert alert-info p-2 small mb-2 bg-light border">
      <strong>Generated Schedule Candidate (draft):</strong> ${esc(entries.length)} sessions planned. Nothing changes for students and faculty until you publish it.
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Slot</th>
            <th>Section</th>
            <th>Subject</th>
            <th>Faculty</th>
            <th>Room</th>
          </tr>
        </thead>
        <tbody>
          ${shown.map(e => `
            <tr>
              <td><strong>${esc(e.dayOfWeek)}</strong></td>
              <td>${esc(e.slotLabel || e.slotId)}</td>
              <td>${esc(e.sectionName || e.sectionId)}</td>
              <td>${esc(e.subjectName || e.subjectCode || e.subjectId)}</td>
              <td>${esc(e.facultyName || e.facultyId)}</td>
              <td>${esc(e.roomName || e.roomId)}</td>
            </tr>
          `).join('')}
          ${entries.length > shown.length ? `<tr><td colspan="6" class="text-center text-muted">+ ${esc(entries.length - shown.length)} more sessions planned</td></tr>` : ''}
        </tbody>
      </table>
    </div>
  `;
}

// ==============================================================================
// 9. Disruptions & Rescheduling View (TC09, TC10, TC11)
// ==============================================================================
/** What each disruption type is about, so the second selector offers the right choices. */
const DISRUPTION_TARGETS = {
  FACULTY_ABSENCE: { entityType: 'FACULTY', label: 'Affected Faculty' },
  SWAP_REQUEST: { entityType: 'FACULTY', label: 'Faculty' },
  ROOM_UNAVAILABILITY: { entityType: 'ROOM', label: 'Affected Room' },
  CLASS_CANCELLATION: { entityType: 'SECTION', label: 'Section' },
  HOLIDAY: { entityType: 'TIMETABLE', label: 'Scope' }
};

function populateDisruptionDropdowns() {
  const typeSelect = document.getElementById('dis-type');
  const entitySelect = document.getElementById('dis-faculty');
  const label = document.getElementById('dis-entity-label');
  if (!typeSelect || !entitySelect) return;

  const target = DISRUPTION_TARGETS[typeSelect.value] || DISRUPTION_TARGETS.FACULTY_ABSENCE;
  const previous = entitySelect.value;
  if (label) label.textContent = target.label;

  const choices = {
    FACULTY: state.faculty.map(f => ({ id: f.id, text: `${f.name} (${f.department})` })),
    ROOM: state.rooms.map(r => ({ id: r.id, text: `${r.name} (${r.building})` })),
    SECTION: state.sections.map(sec => ({ id: sec.id, text: sec.name })),
    TIMETABLE: [{ id: 'ALL', text: 'All sections' }]
  }[target.entityType];

  entitySelect.innerHTML = choices.map(c => `<option value="${esc(c.id)}">${esc(c.text)}</option>`).join('');
  if (choices.some(c => c.id === previous)) entitySelect.value = previous;
}

function initDisruptionFlow() {
  const form = document.getElementById('form-disruption-entry');
  const btnApproveAlt = document.getElementById('btn-approve-selected-alternative');

  document.getElementById('dis-type')?.addEventListener('change', populateDisruptionDropdowns);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('dis-type').value;
      const facultyId = document.getElementById('dis-faculty').value;
      const day = document.getElementById('dis-day').value;
      const slot = document.getElementById('dis-slot').value;
      const reason = document.getElementById('dis-reason').value;

      try {
        // 1. Record Disruption
        const disRes = await api('/api/rescheduling/disruptions', {
          method: 'POST',
          body: JSON.stringify({
            disruptionType: type,
            affectedEntityType: (DISRUPTION_TARGETS[type] || DISRUPTION_TARGETS.FACULTY_ABSENCE).entityType,
            affectedEntityId: facultyId,
            dayOfWeek: day,
            slotId: slot || null,
            reason
          })
        });

        showToast('Disruption recorded. Analyzing schedule impact...');
        state.disruptions = [disRes.disruption, ...state.disruptions];
        triggerImpactAnalysis(disRes.disruption.id);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (btnApproveAlt) {
    btnApproveAlt.addEventListener('click', async () => {
      if (!state.selectedAlternative) {
        showToast('Please select a rescheduling alternative first.', 'error');
        return;
      }

      try {
        const res = await api('/api/rescheduling/approve', {
          method: 'POST',
          // Only the choice is sent; the server rebuilds the timetable itself and records who approved it.
          body: JSON.stringify({
            disruptionId: state.selectedAlternative.disruptionId,
            alternativeId: state.selectedAlternative.id,
            approvalNotes: 'Approved via Rescheduling Decision Workflow.'
          })
        });

        showToast(`Alternative approved! New version ${res.activeVersion?.versionNumber} activated.`);
        document.getElementById('disruption-impact-section').style.display = 'none';
        loadAllData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

async function triggerImpactAnalysis(disruptionId) {
  try {
    const res = await api('/api/rescheduling/generate-alternatives', {
      method: 'POST',
      body: JSON.stringify({ disruptionId })
    });

    const impactSection = document.getElementById('disruption-impact-section');
    impactSection.style.display = 'block';

    // Affected classes table (TC10)
    const affectedTbody = document.getElementById('affected-classes-tbody');
    const affectedBadge = document.getElementById('affected-classes-count-badge');
    const affected = res.impactResult?.affectedEntries || [];

    if (affectedBadge) affectedBadge.textContent = `${affected.length} Affected Class${affected.length === 1 ? '' : 'es'}`;
    if (affectedTbody) {
      affectedTbody.innerHTML = affected.length === 0
        ? `<tr><td colspan="6" class="text-center text-muted">No active classes were affected by this disruption.</td></tr>`
        : affected.map(entry => {
          const sub = state.subjects.find(s => s.id === entry.subjectId);
          const fac = state.faculty.find(f => f.id === entry.facultyId);
          const rm = state.rooms.find(r => r.id === entry.roomId);
          const sectionNames = [entry.sectionId, ...(entry.coSectionIds || [])]
            .map(id => (state.sections.find(sec => sec.id === id) || {}).name || id).join(', ');
          return `
            <tr>
              <td><span class="badge badge-danger">AFFECTED</span></td>
              <td>${esc(sectionNames)}</td>
              <td><strong>${esc(sub ? sub.name : entry.subjectId)}</strong></td>
              <td>${esc(fac ? fac.name : entry.facultyId)}</td>
              <td>${esc(rm ? rm.name : entry.roomId)}</td>
              <td>${esc(entry.dayOfWeek)} (${esc(entry.slotId)})</td>
            </tr>
          `;
        }).join('');
    }

    // Render Alternatives (TC10, TC11)
    renderAlternativeCards(res.comparisonPayload?.rankedAlternatives || res.comparisonPayload?.alternatives || [], disruptionId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderAlternativeCards(alternatives, disruptionId) {
  const container = document.getElementById('alternatives-grid');
  const btnApprove = document.getElementById('btn-approve-selected-alternative');
  if (!container) return;

  container.innerHTML = '';
  state.selectedAlternative = null;
  btnApprove.disabled = true;

  alternatives.forEach((alt, index) => {
    alt.disruptionId = disruptionId;
    const card = document.createElement('div');
    card.className = `alternative-card ${index === 0 ? 'selected' : ''}`;
    
    // Auto-select rank 1 by default
    if (index === 0) {
      state.selectedAlternative = alt;
      btnApprove.disabled = false;
    }

    const isRecommended = alt.rank === 1;

    card.innerHTML = `
      <div class="alt-top-row">
        <div>
          <span class="badge ${isRecommended ? 'badge-success' : 'badge-neutral'}">Rank #${esc(alt.rank)}${isRecommended ? ' &bull; Recommended' : ''}</span>
          <h4 class="alt-name mt-2">${esc(alt.name)}</h4>
        </div>
      </div>

      <div class="alt-metrics-row">
        <span class="alt-metric-pill">Disruption Cost: <strong>${esc(alt.disruptionCost)}</strong></span>
        <span class="alt-metric-pill">Student-Day: <strong>${esc(alt.studentDayQualityScore)}/100</strong></span>
        <span class="alt-metric-pill">Changes: <strong>${esc(alt.changeCount)}</strong></span>
      </div>

      <ul class="alt-mod-list">
        ${(alt.modifiedEntries || []).map(m => m.newFacultyId && m.newFacultyId !== m.oldFacultyId && m.newDay === m.oldDay && m.newSlot === m.oldSlot ? `
          <li>&bull; <strong>${esc(m.subjectName || m.subjectId)}</strong> (${esc(m.oldDay)} ${esc(m.oldSlot)}) taught by <strong>${esc(m.facultyName)}</strong> instead</li>
        ` : `
          <li>&bull; Move <strong>${esc(m.subjectName || m.subjectId)}</strong> from ${esc(m.oldDay)} ${esc(m.oldSlot)} &rarr; <strong>${esc(m.newDay)} ${esc(m.newSlotLabel || m.newSlot)}</strong></li>
        `).join('')}
        ${alt.changeCount === 0 ? `<li>&bull; Keep current schedule unchanged (No impacted entries)</li>` : ''}
      </ul>

      <div class="ai-explanation-box">
        <strong>Ergonomics Analysis:</strong> ${esc(alt.explanation || 'Optimal assignment with zero hard conflicts.')}
      </div>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('.alternative-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedAlternative = alt;
      btnApprove.disabled = false;
    });

    container.appendChild(card);
  });
}

// ==============================================================================
// 10. Versions & Analytics View (TC15, TC16)
// ==============================================================================
function renderAnalytics() {
  const versionsTbody = document.getElementById('versions-tbody');
  if (!versionsTbody) return;

  const metrics = state.activeVersion && state.activeVersion.metrics;
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
  setText('ana-avg-gap', metrics ? metrics.averageGapPerStudentDay : '-');
  setText('ana-room-util', metrics ? `${metrics.roomUtilizationPercent}%` : '-');
  setText('ana-fac-workload', metrics ? metrics.averageFacultyWorkloadHours : '-');
  setText('ana-stability', metrics ? `${metrics.stabilityPercent}%` : '-');

  versionsTbody.innerHTML = state.versions.map(v => {
    const isActive = v.status === 'ACTIVE';
    const isDraft = v.status === 'DRAFT';
    const quality = Number(v.qualityScore) > 0 ? `${Math.round(Number(v.qualityScore))}/100` : '-';
    return `
      <tr>
        <td><strong>${esc(v.versionNumber)}</strong></td>
        <td>${esc(v.name)}<br><small class="text-muted">${esc(v.changeLog || '')}</small></td>
        <td><span class="badge ${isActive ? 'badge-success' : 'badge-neutral'}">${esc(v.status)}</span></td>
        <td>${esc(quality)}</td>
        <td>${esc(v.approvedBy || '-')}</td>
        <td class="text-muted">${esc(new Date(v.createdAt).toLocaleDateString())}</td>
        <td>
          ${isActive ? `<span class="text-muted small">Current Active</span>` : isDraft ? `<span class="text-muted small">Unpublished draft</span>` : `
            <button class="btn btn-secondary btn-sm btn-rollback" data-version-id="${esc(v.id)}" data-version-label="${esc(v.versionNumber)}">
              Roll back
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');

  // Rollback Action (TC16)
  document.querySelectorAll('.btn-rollback').forEach(btn => {
    btn.addEventListener('click', async () => {
      const vId = btn.dataset.versionId;
      if (confirm(`Are you sure you want to rollback the active schedule to version ${btn.dataset.versionLabel}?`)) {
        try {
          const res = await api(`/api/rescheduling/versions/${encodeURIComponent(vId)}/rollback`, { method: 'POST' });
          showToast(res.message);
          loadAllData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

// ==============================================================================
// 11. AI Constraint Assistant View
// ==============================================================================
function initAIAssistant() {
  const promptInput = document.getElementById('ai-prompt-input');
  const btnInterpret = document.getElementById('btn-interpret-prompt');
  const validationCard = document.getElementById('ai-validation-container');
  const btnConfirmAI = document.getElementById('btn-confirm-validate-ai');

  // Quick Chips
  document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (promptInput) promptInput.value = chip.dataset.prompt;
    });
  });

  if (btnInterpret) {
    btnInterpret.addEventListener('click', async () => {
      const prompt = promptInput.value.trim();
      if (!prompt) {
        showToast('Please type a natural-language prompt.', 'error');
        return;
      }

      try {
        const res = await api('/api/ai/interpret', {
          method: 'POST',
          body: JSON.stringify({ prompt })
        });

        state.lastInterpretedAI = res.result;

        // Display Interpreted Preview
        validationCard.style.display = 'block';
        const contentEl = document.getElementById('ai-interpreted-content');
        const c = res.result.structuredConstraint;

        contentEl.innerHTML = `
          <div class="p-3 bg-light border rounded">
            <div><strong>Interpreted Disruption:</strong> ${esc(c.disruptionType)}</div>
            <div><strong>Entity:</strong> ${esc(c.affectedEntityName || c.affectedEntityId)} (${esc(c.affectedEntityType)})</div>
            <div><strong>Target Day & Slot:</strong> ${esc(c.dayOfWeek)} - ${esc(c.slotId || 'All Day')}</div>
            <div><strong>Confidence:</strong> ${esc((c.confidence * 100).toFixed(0))}%</div>
          </div>
        `;

        // Pre-fill Admin verification fields
        document.getElementById('ai-val-day').value = c.dayOfWeek || 'Tuesday';
        document.getElementById('ai-val-slot').value = c.slotId || '';
        document.getElementById('ai-val-entity').value = c.affectedEntityId || '';
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (btnConfirmAI) {
    btnConfirmAI.addEventListener('click', async () => {
      if (!state.lastInterpretedAI) return;

      const adminCorrections = {
        dayOfWeek: document.getElementById('ai-val-day').value,
        slotId: document.getElementById('ai-val-slot').value,
        affectedEntityId: document.getElementById('ai-val-entity').value
      };

      try {
        // Step 2: Validate constraint wrapper
        const valRes = await api('/api/ai/validate', {
          method: 'POST',
          body: JSON.stringify({
            interpretedResult: state.lastInterpretedAI,
            adminCorrections
          })
        });

        showToast('Constraint human-validated. Applying to rescheduling engine...');

        // Convert into disruption and navigate to Disruptions
        const c = valRes.validatedResult.validatedConstraint;
        const disRes = await api('/api/rescheduling/disruptions', {
          method: 'POST',
          body: JSON.stringify({
            disruptionType: c.disruptionType,
            affectedEntityType: c.affectedEntityType,
            affectedEntityId: c.affectedEntityId,
            dayOfWeek: c.dayOfWeek,
            slotId: c.slotId,
            reason: c.reason
          })
        });

        validationCard.style.display = 'none';
        navigateTo('disruptions');
        triggerImpactAnalysis(disRes.disruption.id);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

// ==============================================================================
// 12. Notifications (TC14, TC15)
// ==============================================================================
async function loadNotifications() {
  if (!state.token) return;
  try {
    const res = await api('/api/notifications');
    if (res.success) {
      state.notifications = res.notifications || [];
      const badge = document.getElementById('nav-notif-badge');
      if (badge) {
        badge.textContent = String(state.notifications.length);
        if (state.notifications.length > 0) {
          badge.classList.add('visible');
        } else {
          badge.classList.remove('visible');
        }
      }
    }
  } catch (err) {
    console.warn('Error loading notifications:', err);
  }
}

function renderNotifications() {
  const container = document.getElementById('notifications-list');
  if (!container) return;

  if (state.notifications.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-muted">You have no unread schedule notifications.</div>`;
    return;
  }

  container.innerHTML = state.notifications.map(n => `
    <div class="notif-card unread" id="notif-${esc(n.id)}">
      <div class="notif-content">
        <span class="notif-title">${esc(n.subjectName)} Reschedule Notice</span>
        <p class="notif-msg">${esc(n.message)}</p>
        <span class="notif-time">${esc(new Date(n.createdAt).toLocaleTimeString())} &bull; ${esc(new Date(n.createdAt).toLocaleDateString())}</span>
      </div>
      <button class="btn btn-secondary btn-sm btn-mark-read" data-id="${esc(n.id)}">
        Mark as read
      </button>
    </div>
  `).join('');

  // Mark as read click handlers (TC15)
  document.querySelectorAll('.btn-mark-read').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        await api(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
        showToast('Notification marked as read.');
        loadNotifications().then(renderNotifications);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

/**
 * "Mark all as read" button: one request, attached once (not on every render).
 */
function initMarkAllRead() {
  const btnMarkAll = document.getElementById('btn-mark-all-read');
  if (!btnMarkAll) return;
  btnMarkAll.addEventListener('click', async () => {
    try {
      await api('/api/notifications/read-all', { method: 'POST', body: JSON.stringify({}) });
      showToast('All notifications marked as read.');
      loadNotifications().then(renderNotifications);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ==============================================================================
// 13. Initialization
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Redraw the grid when the window crosses the phone breakpoint (rotation, resizing).
  window.matchMedia('(max-width: 640px)').addEventListener('change', () => {
    if (state.currentPage === 'timetable') renderTimetable();
  });
  captureGoogleReturn();
  initSettings();
  // Navigation clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  // Filter change listeners
  const ttSection = document.getElementById('tt-filter-section');
  const ttView = document.getElementById('tt-view-selector');
  const ttDay = document.getElementById('tt-filter-day');

  if (ttSection) ttSection.addEventListener('change', renderTimetable);
  if (ttView) ttView.addEventListener('change', renderTimetable);
  if (ttDay) ttDay.addEventListener('change', renderTimetable);

  // Initialize modules
  initAuth();
  initPrintAction();
  initGoogleCalendarActions();
  initAcademicTabs();
  initGenerationEngine();
  initDisruptionFlow();
  initAIAssistant();
  initMarkAllRead();
});
