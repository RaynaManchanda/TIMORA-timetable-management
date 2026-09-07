/**
 * TIMORA - Adaptive Scheduling & AI UI Client Logic
 */

let currentMetadata = null;
let currentImpactResult = null;
let currentDisruptionId = null;
let currentAiInterpretedResult = null;

document.addEventListener('DOMContentLoaded', () => {
  loadMetadata();
  loadDisruptions();
  loadVersionHistory();

  document.getElementById('disruptionForm').addEventListener('submit', handleRecordDisruption);
  document.getElementById('btnAiInterpret').addEventListener('click', handleAiInterpret);
  document.getElementById('btnConfirmAiValidation').addEventListener('click', handleConfirmAiValidation);
  document.getElementById('btnGenerateReschedule').addEventListener('click', handleGenerateAlternatives);
});

// Tab Switcher
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  event.target.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

// Load System Metadata
async function loadMetadata() {
  try {
    const res = await fetch('/api/rescheduling/metadata');
    const data = await res.json();
    if (data.success) {
      currentMetadata = data;
      populateEntityDropdown();
    }
  } catch (err) {
    console.error('Failed to load metadata:', err);
  }
}

function populateEntityDropdown() {
  const entitySelect = document.getElementById('affectedEntity');
  entitySelect.innerHTML = '';

  if (!currentMetadata) return;

  const groupFaculty = document.createElement('optgroup');
  groupFaculty.label = 'Faculty';
  currentMetadata.faculty.forEach(f => {
    groupFaculty.appendChild(new Option(`${f.name} (${f.department})`, f.id));
  });

  const groupRooms = document.createElement('optgroup');
  groupRooms.label = 'Rooms / Labs';
  currentMetadata.rooms.forEach(r => {
    groupRooms.appendChild(new Option(`${r.name} (${r.building} - ${r.type})`, r.id));
  });

  const groupSections = document.createElement('optgroup');
  groupSections.label = 'Student Sections';
  currentMetadata.sections.forEach(s => {
    groupSections.appendChild(new Option(`${s.name} (${s.program})`, s.id));
  });

  entitySelect.appendChild(groupFaculty);
  entitySelect.appendChild(groupRooms);
  entitySelect.appendChild(groupSections);
}

// Record Disruption Form Submit
async function handleRecordDisruption(e) {
  e.preventDefault();

  const disruptionType = document.getElementById('disruptionType').value;
  const affectedEntityId = document.getElementById('affectedEntity').value;
  const dayOfWeek = document.getElementById('disruptionDay').value;
  const slotId = document.getElementById('disruptionSlot').value;
  const reason = document.getElementById('disruptionReason').value;

  const payload = {
    disruptionType,
    affectedEntityType: 'FACULTY',
    affectedEntityId,
    dayOfWeek,
    slotId: slotId || null,
    reason
  };

  try {
    const res = await fetch('/api/rescheduling/disruptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert(`Disruption recorded successfully (ID: ${data.disruption.id})`);
      loadDisruptions();
      runImpactAnalysis(data.disruption.id);
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Failed to record disruption: ${err.message}`);
  }
}

// Load Recorded Disruptions
async function loadDisruptions() {
  try {
    const res = await fetch('/api/rescheduling/disruptions');
    const data = await res.json();
    const container = document.getElementById('disruptionsList');

    if (!data.success || data.disruptions.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">No disruptions recorded yet.</p>';
      return;
    }

    container.innerHTML = data.disruptions.map(d => `
      <div style="background: rgba(15,23,42,0.6); padding: 12px 16px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color: var(--text-main); font-size: 0.9rem;">${d.disruptionType}</strong>
          <p style="font-size: 0.8rem; color: var(--text-muted);">${d.dayOfWeek} ${d.slotId ? '(' + d.slotId + ')' : '(Full Day)'} - ${d.reason}</p>
        </div>
        <div>
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="runImpactAnalysis('${d.id}')">Analyze Impact</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load disruptions:', err);
  }
}

// Run Targeted Impact Analysis
async function runImpactAnalysis(disruptionId) {
  currentDisruptionId = disruptionId;
  try {
    const res = await fetch(`/api/rescheduling/disruptions/${disruptionId}/analyze`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      currentImpactResult = data.impactResult;
      renderImpactAnalysis(data.impactResult);

      // Automatically switch to Tab 2
      document.querySelectorAll('.tab-btn')[1].click();
    }
  } catch (err) {
    alert(`Impact analysis failed: ${err.message}`);
  }
}

function renderImpactAnalysis(impact) {
  const summaryBox = document.getElementById('impactSummaryBox');
  const tbody = document.querySelector('#impactTable tbody');
  const btnGenerate = document.getElementById('btnGenerateReschedule');

  summaryBox.innerHTML = `
    <div class="grid-3">
      <div style="background: rgba(244,63,94,0.1); border: 1px solid var(--accent-rose); padding: 12px; border-radius: 8px;">
        <p style="font-size: 0.8rem; color: #fda4af;">Affected Classes</p>
        <h3 style="color: #f43f5e;">${impact.affectedCount}</h3>
      </div>
      <div style="background: rgba(16,185,129,0.1); border: 1px solid var(--accent-emerald); padding: 12px; border-radius: 8px;">
        <p style="font-size: 0.8rem; color: #6ee7b7;">Preserved Classes (Untouched)</p>
        <h3 style="color: #10b981;">${impact.preservedCount}</h3>
      </div>
      <div style="background: rgba(59,130,246,0.1); border: 1px solid var(--primary); padding: 12px; border-radius: 8px;">
        <p style="font-size: 0.8rem; color: #93c5fd;">Total Active Classes</p>
        <h3 style="color: #3b82f6;">${impact.totalEntries}</h3>
      </div>
    </div>
  `;

  const allEntries = [...impact.affectedEntries, ...impact.preservedEntries];

  tbody.innerHTML = allEntries.map(e => `
    <tr>
      <td>
        <span class="badge ${e.isAffected ? 'badge-affected' : 'badge-preserved'}">
          ${e.isAffected ? 'AFFECTED' : 'PRESERVED'}
        </span>
      </td>
      <td>${e.id}</td>
      <td>${e.sectionId}</td>
      <td>${e.subjectId}</td>
      <td>${e.facultyId}</td>
      <td>${e.roomId}</td>
      <td>${e.dayOfWeek} (${e.slotId})</td>
    </tr>
  `).join('');

  btnGenerate.style.display = 'inline-flex';
}

// Generate Alternatives
async function handleGenerateAlternatives() {
  if (!currentDisruptionId) {
    alert('Please record or select a disruption first.');
    return;
  }

  try {
    const res = await fetch('/api/rescheduling/generate-alternatives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disruptionId: currentDisruptionId })
    });
    const data = await res.json();
    if (data.success) {
      renderAlternatives(data.comparisonPayload.rankedAlternatives);
      document.querySelectorAll('.tab-btn')[2].click();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Failed to generate alternatives: ${err.message}`);
  }
}

function renderAlternatives(alternatives) {
  const container = document.getElementById('alternativesContainer');

  if (!alternatives || alternatives.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);">No feasible rescheduling alternatives found satisfying hard constraints.</p>';
    return;
  }

  container.innerHTML = alternatives.map(alt => `
    <div class="card" style="${alt.isRecommended ? 'border: 2px solid var(--accent-emerald); background: rgba(16,185,129,0.05);' : ''}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div>
          ${alt.isRecommended ? '<span class="badge badge-preserved" style="margin-bottom: 6px;">TOP RECOMMENDATION (RANK #1)</span>' : `<span class="badge" style="background: rgba(255,255,255,0.1); color: white; margin-bottom: 6px;">RANK #${alt.rank}</span>`}
          <h3 style="font-size: 1.1rem; color: var(--text-main);">${alt.name}</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">${alt.description}</p>
        </div>
        <div style="text-align: right;">
          <span class="score-pill ${alt.compositeScore >= 40 ? 'score-high' : 'score-mid'}">
            Score: ${alt.compositeScore}
          </span>
        </div>
      </div>

      <div class="grid-3" style="margin: 16px 0;">
        <div style="background: rgba(15,23,42,0.6); padding: 10px; border-radius: 6px;">
          <p style="font-size: 0.75rem; color: var(--text-muted);">Changes Made</p>
          <strong style="color: var(--text-main);">${alt.changeCount} Class(es)</strong>
        </div>
        <div style="background: rgba(15,23,42,0.6); padding: 10px; border-radius: 6px;">
          <p style="font-size: 0.75rem; color: var(--text-muted);">Disruption Cost</p>
          <strong style="color: #fbbf24;">${alt.disruptionCost}</strong>
        </div>
        <div style="background: rgba(15,23,42,0.6); padding: 10px; border-radius: 6px;">
          <p style="font-size: 0.75rem; color: var(--text-muted);">Student Day Quality</p>
          <strong style="color: #34d399;">${alt.studentDayQualityScore} / 100</strong>
        </div>
      </div>

      <div style="background: rgba(59,130,246,0.1); border-left: 3px solid var(--primary); padding: 12px; border-radius: 4px; margin-bottom: 16px;">
        <p style="font-size: 0.85rem; color: #93c5fd;"><strong>🤖 AI Explanation:</strong> ${alt.explanation || 'Verified constraint compliant option.'}</p>
      </div>

      <div style="display: flex; justify-content: flex-end;">
        <button class="btn btn-success" onclick="approveOption('${alt.id}', '${encodeURIComponent(JSON.stringify(alt))}')">
          Approve & Publish Version
        </button>
      </div>
    </div>
  `).join('');
}

// Approve Alternative
async function approveOption(altId, encodedAlt) {
  const alt = JSON.parse(decodeURIComponent(encodedAlt));
  if (!confirm(`Are you sure you want to approve "${alt.name}"? This will create a new official timetable version.`)) {
    return;
  }

  try {
    const res = await fetch('/api/rescheduling/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alternative: alt,
        disruptionId: currentDisruptionId,
        approvedBy: 'Administrator',
        approvalNotes: 'Approved via TIMORA dashboard'
      })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Success! Approved version ${data.version.versionNumber} created.`);
      loadVersionHistory();
      document.querySelectorAll('.tab-btn')[3].click();
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Approval failed: ${err.message}`);
  }
}

// Version History & Rollback
async function loadVersionHistory() {
  try {
    const res = await fetch('/api/rescheduling/versions');
    const data = await res.json();
    const container = document.getElementById('versionHistoryList');
    const activePill = document.getElementById('activeVersionPill');

    if (data.success) {
      activePill.textContent = `Active Version: ${data.activeVersion.versionNumber} (${data.activeVersion.name})`;

      container.innerHTML = data.versions.map(v => `
        <div style="background: rgba(15,23,42,0.6); padding: 16px; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="badge ${v.status === 'ACTIVE' ? 'badge-preserved' : 'badge-affected'}">${v.status}</span>
              <strong style="font-size: 1rem; color: var(--text-main);">${v.versionNumber} - ${v.name}</strong>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px;">
              Approved By: ${v.approvedBy} | Created: ${new Date(v.createdAt).toLocaleString()}
            </p>
            <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 4px;">Log: ${v.changeLog}</p>
          </div>
          <div>
            ${v.status !== 'ACTIVE' ? `<button class="btn btn-secondary" onclick="rollbackVersion('${v.id}')">Rollback to This Version</button>` : '<span style="color: #34d399; font-size: 0.85rem; font-weight: 600;">ACTIVE VERSION</span>'}
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load versions:', err);
  }
}

async function rollbackVersion(versionId) {
  if (!confirm('Are you sure you want to rollback to this previous timetable version?')) return;

  try {
    const res = await fetch(`/api/rescheduling/versions/${versionId}/rollback`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      loadVersionHistory();
    } else {
      alert(`Rollback error: ${data.error}`);
    }
  } catch (err) {
    alert(`Rollback failed: ${err.message}`);
  }
}

// AI Console Prompt Handler
async function handleAiInterpret() {
  const promptText = document.getElementById('aiPromptInput').value;
  if (!promptText.trim()) {
    alert('Please enter a natural language request.');
    return;
  }

  try {
    const res = await fetch('/api/ai/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText })
    });
    const data = await res.json();

    if (data.success) {
      currentAiInterpretedResult = data.result;
      document.getElementById('modalRawPrompt').textContent = data.result.rawPrompt;
      document.getElementById('modalStructuredJson').textContent = JSON.stringify(data.result.structuredConstraint, null, 2);
      document.getElementById('aiValidationModal').classList.add('open');
    }
  } catch (err) {
    alert(`AI interpretation failed: ${err.message}`);
  }
}

function closeAiModal() {
  document.getElementById('aiValidationModal').classList.remove('open');
}

// Confirm AI Validation -> Record Disruption
async function handleConfirmAiValidation() {
  if (!currentAiInterpretedResult) return;

  try {
    const res = await fetch('/api/ai/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interpretedResult: currentAiInterpretedResult,
        adminCorrections: {}
      })
    });
    const data = await res.json();

    if (data.success) {
      closeAiModal();
      const validated = data.validatedResult.validatedConstraint;

      // Fill and record disruption
      const disruptionPayload = {
        disruptionType: validated.disruptionType,
        affectedEntityType: validated.affectedEntityType,
        affectedEntityId: validated.affectedEntityId,
        dayOfWeek: validated.dayOfWeek,
        slotId: validated.slotId,
        reason: `AI Interpreted: ${validated.reason}`
      };

      const recordRes = await fetch('/api/rescheduling/disruptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(disruptionPayload)
      });
      const recordData = await recordRes.json();

      if (recordData.success) {
        alert('AI Constraint validated & recorded successfully!');
        loadDisruptions();
        runImpactAnalysis(recordData.disruption.id);
      }
    }
  } catch (err) {
    alert(`Validation failed: ${err.message}`);
  }
}
