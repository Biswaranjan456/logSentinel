/**
 * js/logs.js — Log Viewer Logic & Filters
 * Handles: live feed, filters, table, anomaly table, upload
 */

// ── State ──────────────────────────────────────────────────────────────────
let allLogs     = [...MOCK.logMessages.map((m, i) => ({
  ...m,
  time: new Date(Date.now() - (MOCK.logMessages.length - i) * 8000).toTimeString().slice(0, 8),
  id: i + 1,
}))];
let paused      = false;
let liveTimer   = null;
let selectedFile = null;

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderLogFeed();
  renderLogTable();
  renderAnomalyTable();
  startLiveFeed();
  initUploadZone();
});

// ── Live Feed ──────────────────────────────────────────────────────────────
function startLiveFeed() {
  liveTimer = startLiveLogs(onNewLog);
}

function onNewLog(entry) {
  if (paused) return;
  allLogs.unshift(entry);
  if (allLogs.length > 500) allLogs.pop();

  appendLogRow(entry);
  updateLogCount();
  renderLogTable(); // refresh table
}

function appendLogRow(entry) {
  const feed = document.getElementById('log-feed');
  if (!feed) return;

  const row = document.createElement('div');
  row.className = 'log-entry';
  row.innerHTML = `
    <span class="log-time">${entry.time}</span>
    <span class="log-level ${entry.level}">${entry.level}</span>
    <span class="log-source">${entry.source}</span>
    <span class="log-msg">${entry.message}</span>`;
  feed.insertBefore(row, feed.firstChild);

  while (feed.children.length > 80) feed.removeChild(feed.lastChild);
}

function renderLogFeed() {
  const feed = document.getElementById('log-feed');
  if (!feed) return;
  feed.innerHTML = '';
  allLogs.slice(0, 20).forEach(appendLogRow);
  updateLogCount();
}

function updateLogCount() {
  const el = document.getElementById('log-count');
  if (el) el.textContent = `${allLogs.length.toLocaleString()} entries`;
}

// ── Pause / Clear ──────────────────────────────────────────────────────────
window.togglePause = function() {
  paused = !paused;
  const btn = document.getElementById('pause-btn');
  if (!btn) return;
  btn.textContent = paused ? '▶ Resume' : '⏸ Pause';
  btn.className   = paused ? 'btn btn-danger' : 'btn btn-primary';
};

window.clearLogs = function() {
  allLogs = [];
  const feed = document.getElementById('log-feed');
  if (feed) feed.innerHTML = '';
  renderLogTable();
  updateLogCount();
  toast('Logs Cleared', 'All captured log entries removed', '🗑️');
};

// ── Log Table with filters ─────────────────────────────────────────────────
window.filterLogs = function() { renderLogTable(); };

function renderLogTable() {
  const tbody   = document.getElementById('log-table-body');
  if (!tbody) return;

  const search  = (document.getElementById('log-search')       ?.value || '').toLowerCase();
  const level   =  document.getElementById('log-level-filter') ?.value || '';
  const source  =  document.getElementById('log-source-filter')?.value || '';

  const filtered = allLogs.filter(l =>
    (!level  || l.level  === level)  &&
    (!source || l.source === source) &&
    (!search || l.message.toLowerCase().includes(search) || l.source.toLowerCase().includes(search))
  ).slice(0, 150);

  const pillMap = { ERROR:'pill-danger', WARN:'pill-warning', INFO:'pill-info', DEBUG:'pill-success' };

  tbody.innerHTML = filtered.map((l, i) => `
    <tr>
      <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted)">${i + 1}</td>
      <td style="font-family:'Space Mono',monospace;font-size:10px">${l.time}</td>
      <td><span class="pill ${pillMap[l.level] || ''}">${l.level}</span></td>
      <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--info)">${l.source}</td>
      <td style="max-width:400px;font-size:11px;opacity:0.8">${l.message}</td>
    </tr>
  `).join('');
}

// ── Anomaly Table ──────────────────────────────────────────────────────────
window.filterAnomalies = function() { renderAnomalyTable(); };

function renderAnomalyTable() {
  const tbody  = document.getElementById('anomaly-table-body');
  if (!tbody) return;

  const search = (document.getElementById('anomaly-search')    ?.value || '').toLowerCase();
  const sev    =  document.getElementById('anomaly-sev-filter')?.value || '';

  const filtered = MOCK.anomalies.filter(a =>
    (!sev    || a.severity === sev) &&
    (!search || a.name.toLowerCase().includes(search) || a.source.toLowerCase().includes(search))
  );

  const sevPill = { critical:'pill-danger', high:'pill-warning', medium:'pill-info', low:'pill-success' };

  tbody.innerHTML = filtered.map(a => `
    <tr>
      <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted)">#${a.id}</td>
      <td style="font-weight:700;font-size:12px">${a.name}</td>
      <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--info)">${a.source}</td>
      <td><span class="pill ${sevPill[a.severity]}">${a.severity.toUpperCase()}</span></td>
      <td style="font-weight:700">${a.count.toLocaleString()}</td>
      <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted)">${a.time}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" style="font-size:10px;padding:4px 8px"
            onclick="viewAnomaly(${a.id})">View</button>
          <button class="btn btn-danger" style="font-size:10px;padding:4px 8px"
            onclick="resolveAnomaly(${a.id})">Resolve</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.viewAnomaly = function(id) {
  const a = MOCK.anomalies.find(x => x.id === id);
  if (!a) return;
  toast(`Anomaly #${id}`, `${a.name} — ${a.count.toLocaleString()} events from ${a.source}`, '🔍');
};

window.resolveAnomaly = function(id) {
  const idx = MOCK.anomalies.findIndex(x => x.id === id);
  if (idx === -1) return;
  MOCK.anomalies.splice(idx, 1);
  renderAnomalyTable();

  // Update stat cards
  document.querySelectorAll('[id^="sev-count-"]').forEach(el => {});
  toast('Anomaly Resolved', `Issue #${id} marked as resolved`, '✅');

  // Re-tally severity counts
  renderSeverityCounts();
};

function renderSeverityCounts() {
  ['critical','high','medium','low'].forEach(sev => {
    const el = document.getElementById(`sev-${sev}`);
    if (el) el.textContent = MOCK.anomalies.filter(a => a.severity === sev).length;
  });
}

// ── Upload ─────────────────────────────────────────────────────────────────
function initUploadZone() {
  const zone = document.getElementById('upload-zone');
  if (!zone) return;
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) showUploadPreview(file);
  });
}

window.handleFileSelect = function(e) {
  const file = e.target.files[0];
  if (file) showUploadPreview(file);
};

function showUploadPreview(file) {
  selectedFile = file;
  setText('upload-filename', file.name);
  setText('upload-size', formatBytes(file.size));
  show('upload-preview');
}

window.cancelUpload = function() {
  selectedFile = null;
  hide('upload-preview');
  const inp = document.getElementById('file-input');
  if (inp) inp.value = '';
};

window.uploadFile = async function() {
  if (!selectedFile) return;
  hide('upload-preview');
  show('upload-progress');

  // Simulate progress
  let pct = 0;
  const bar   = document.getElementById('upload-bar');
  const pctEl = document.getElementById('upload-pct');
  const timer = setInterval(() => {
    pct = Math.min(pct + Math.random() * 14, 100);
    if (bar)   bar.style.width   = `${pct}%`;
    if (pctEl) pctEl.textContent = `${Math.floor(pct)}%`;
    if (pct >= 100) {
      clearInterval(timer);
      setTimeout(() => {
        hide('upload-progress');
        window.cancelUpload();
        toast('Upload Complete', `${selectedFile?.name || 'File'} processed — scan running`, '✅');
        selectedFile = null;
      }, 400);
    }
  }, 140);

  // Real call (uncomment when backend ready):
  // const fd = new FormData();
  // fd.append('file', selectedFile);
  // await logsAPI.uploadLog(fd).catch(console.error);
};

// ── Helpers ────────────────────────────────────────────────────────────────
function show(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = '';
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
