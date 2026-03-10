/**
 * js/logs.js — Log Viewer Logic
 * Fixed: upload response display, level filter in All Logs tab, all bugs
 */

// ── State ──────────────────────────────────────────────────────────────────
let paused       = false;
let liveTimer    = null;
let selectedFile = null;

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadLogs();
  loadAnomalies();
  startLiveFeed();
  initUploadZone();
  initLogFilters(); // Level filter fix
});

// ══════════════════════════════════════════════════════
//  LIVE FEED
// ══════════════════════════════════════════════════════
function startLiveFeed() {
  // Pehle mock logs dikhao — instant feedback
  MOCK.logMessages.forEach(m => appendLogRow({
    ...m,
    timestamp: new Date().toISOString(),
  }));

  // Phir har 5 second mein real API se fetch karo
  liveTimer = setInterval(async () => {
    if (paused) return;
    try {
      const res  = await logsAPI.getLogs({ limit: 3, page: 1 });
      const logs = res.data || [];
      logs.forEach(log => appendLogRow(log));
      updateLogCount(res.total);
    } catch {
      // Backend offline — mock use karo
      const m = MOCK.logMessages[Math.floor(Math.random() * MOCK.logMessages.length)];
      appendLogRow({ ...m, timestamp: new Date().toISOString() });
    }
  }, 5000);
}

function appendLogRow(log) {
  const feed = document.getElementById('log-feed');
  if (!feed) return;

  const row = document.createElement('div');
  row.className = 'log-entry';
  row.innerHTML = `
    <span class="log-time">${fmtTime(log.timestamp)}</span>
    <span class="log-level ${log.level}">${log.level}</span>
    <span class="log-source">${log.source}</span>
    <span class="log-msg">${log.message}</span>`;

  feed.insertBefore(row, feed.firstChild);

  // Max 100 rows rakhna
  while (feed.children.length > 100) feed.removeChild(feed.lastChild);
}

function updateLogCount(total) {
  const t = total || 0;
  const el  = document.getElementById('log-count');
  const el2 = document.getElementById('log-count-2');
  if (el)  el.textContent  = `${t.toLocaleString()} entries`;
  if (el2) el2.textContent = `${t.toLocaleString()} entries`;
}

window.togglePause = function() {
  paused = !paused;
  const btn = document.getElementById('pause-btn');
  if (!btn) return;
  btn.textContent = paused ? '▶ Resume' : '⏸ Pause';
  btn.className   = paused ? 'btn btn-danger' : 'btn btn-primary';
  toast(paused ? 'Feed Paused' : 'Feed Resumed', '', paused ? '⏸' : '▶');
};

window.clearLogs = function() {
  const feed = document.getElementById('log-feed');
  if (feed) feed.innerHTML = '';
  toast('Cleared', 'Live feed cleared', '🗑️');
};

// ══════════════════════════════════════════════════════
//  LOG TABLE — GET /api/logs
//  FIX: Level filter, source filter, search — sab kaam karte hain
// ══════════════════════════════════════════════════════
async function loadLogs() {
  const tbody = document.getElementById('log-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">Loading…</td></tr>';

  // Filters se params banao
  const level  = document.getElementById('log-level-filter')?.value  || '';
  const source = document.getElementById('log-source-filter')?.value || '';
  const search = document.getElementById('log-search')?.value        || '';

  const params = { page: 1, limit: 100 };
  if (level)  params.level  = level;
  if (source) params.source = source;
  if (search) params.search = search;

  try {
    const res  = await logsAPI.getLogs(params);
    const logs = res.data || [];
    updateLogCount(res.total);
    renderLogTable(logs);
  } catch (err) {
    console.warn('Logs fetch failed:', err.message);
    // Mock data fallback
    const mockLogs = MOCK.logMessages.map((m, i) => ({
      ...m, id: i, timestamp: new Date().toISOString()
    }));
    renderLogTable(mockLogs);
  }
}

// Filter change hone par call hota hai
window.filterLogs = function() { loadLogs(); };

function renderLogTable(logs) {
  const tbody = document.getElementById('log-table-body');
  if (!tbody) return;

  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">No logs found</td></tr>';
    return;
  }

  const pillMap = {
    ERROR: 'pill-danger',
    WARN : 'pill-warning',
    INFO : 'pill-info',
    DEBUG: 'pill-success',
  };

  tbody.innerHTML = logs.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${fmtTime(l.timestamp)}</td>
      <td><span class="pill ${pillMap[l.level] || ''}">${l.level}</span></td>
      <td>${l.source}</td>
      <td>${l.message}</td>
    </tr>`).join('');
}

// ── Log Filters Init — All Logs tab ke liye ───────────────────────────────
function initLogFilters() {
  // All Logs tab ke filters bhi add karo agar nahi hain
  const allTab = document.getElementById('tab-all');
  if (!allTab) return;

  // Check karo filter bar hai ya nahi
  let filterBar = allTab.querySelector('.filter-bar');
  if (!filterBar) {
    // Filter bar nahi hai — add karo
    filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';
    filterBar.innerHTML = `
      <input class="search-input" type="text" placeholder="Search logs…"
        id="log-search-all" oninput="filterAllLogs()"/>
      <select class="select-input" id="log-level-filter-all" onchange="filterAllLogs()">
        <option value="">All Levels</option>
        <option value="ERROR">ERROR</option>
        <option value="WARN">WARN</option>
        <option value="INFO">INFO</option>
        <option value="DEBUG">DEBUG</option>
      </select>
      <select class="select-input" id="log-source-filter-all" onchange="filterAllLogs()">
        <option value="">All Sources</option>
        <option value="auth-service">auth-service</option>
        <option value="api-gateway">api-gateway</option>
        <option value="db-connector">db-connector</option>
        <option value="rate-limiter">rate-limiter</option>
        <option value="ml-detector">ml-detector</option>
        <option value="firewall">firewall</option>
      </select>`;

    // Panel ke pehle insert karo
    const panel = allTab.querySelector('.panel');
    if (panel) allTab.insertBefore(filterBar, panel);
  }
}

// All Logs tab ka alag filter
window.filterAllLogs = async function() {
  const tbody = document.getElementById('log-table-body');
  if (!tbody) return;

  const level  = document.getElementById('log-level-filter-all')?.value  || '';
  const source = document.getElementById('log-source-filter-all')?.value || '';
  const search = document.getElementById('log-search-all')?.value        || '';

  const params = { page: 1, limit: 100 };
  if (level)  params.level  = level;
  if (source) params.source = source;
  if (search) params.search = search;

  try {
    const res = await logsAPI.getLogs(params);
    updateLogCount(res.total);
    renderLogTable(res.data || []);
  } catch {
    renderLogTable([]);
  }
};

// ══════════════════════════════════════════════════════
//  ANOMALY TABLE — GET /api/anomalies
// ══════════════════════════════════════════════════════
async function loadAnomalies() {
  const tbody = document.getElementById('anomaly-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted)">Loading…</td></tr>';

  const sev    = document.getElementById('anomaly-sev-filter')?.value || '';
  const search = document.getElementById('anomaly-search')?.value     || '';

  const params = { page: 1, limit: 50 };
  if (sev)    params.severity = sev;
  if (search) params.source   = search;

  try {
    const res = await anomalyAPI.getAll(params);
    renderAnomalyTable(res.data || []);
    renderSeverityCounts(res);
  } catch (err) {
    console.warn('Anomalies fetch failed:', err.message);
    renderAnomalyTableMock();
  }
}

window.filterAnomalies = function() { loadAnomalies(); };

function renderAnomalyTable(anomalies) {
  const tbody = document.getElementById('anomaly-table-body');
  if (!tbody) return;

  if (!anomalies.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted)">No anomalies found 🎉</td></tr>';
    return;
  }

  const sevPill = {
    critical: 'pill-danger',
    high    : 'pill-warning',
    medium  : 'pill-info',
    low     : 'pill-success',
  };

  tbody.innerHTML = anomalies.map(a => `
    <tr>
      <td>${String(a.id).slice(-6)}</td>
      <td>${a.name}</td>
      <td>${a.source}</td>
      <td><span class="pill ${sevPill[a.severity] || ''}">${a.severity.toUpperCase()}</span></td>
      <td>${(a.event_count || 0).toLocaleString()}</td>
      <td>${timeAgo(a.detected_at)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" style="font-size:10px;padding:4px 8px"
            onclick="viewAnomaly('${a.id}')">View</button>
          <button class="btn btn-danger" style="font-size:10px;padding:4px 8px"
            onclick="resolveAnomaly('${a.id}')">Resolve</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderSeverityCounts(res) {
  const map = {
    'sev-critical': res.critical || 0,
    'sev-high'    : res.high     || 0,
    'sev-medium'  : res.medium   || 0,
    'sev-low'     : res.low      || 0,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

function renderAnomalyTableMock() {
  const sevPill = { critical:'pill-danger', high:'pill-warning', medium:'pill-info', low:'pill-success' };
  const tbody = document.getElementById('anomaly-table-body');
  if (!tbody) return;
  tbody.innerHTML = MOCK.anomalies.map(a => `
    <tr>
      <td>#${a.id}</td>
      <td>${a.name}</td>
      <td>${a.source}</td>
      <td><span class="pill ${sevPill[a.severity]}">${a.severity.toUpperCase()}</span></td>
      <td>${a.count.toLocaleString()}</td>
      <td>${a.time}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" style="font-size:10px;padding:4px 8px">View</button>
          <button class="btn btn-danger" style="font-size:10px;padding:4px 8px">Resolve</button>
        </div>
      </td>
    </tr>`).join('');
  renderSeverityCounts({ critical:2, high:2, medium:2, low:2 });
}

// ── View Anomaly ───────────────────────────────────────────────────────────
window.viewAnomaly = async function(id) {
  try {
    const a = await anomalyAPI.getOne(id);
    toast(
      a.name,
      `${a.description} · Source: ${a.source} · Events: ${a.event_count}`,
      '🔍'
    );
  } catch {
    toast('Anomaly Detail', `ID: ${id}`, '🔍');
  }
};

// ── Resolve Anomaly — PUT /api/anomalies/{id}/resolve ─────────────────────
window.resolveAnomaly = async function(id) {
  try {
    await anomalyAPI.resolve(id);
    toast('Resolved ✅', `Anomaly #${String(id).slice(-6)} resolved`, '✅');
    await loadAnomalies(); // Table refresh karo
  } catch (err) {
    toast('Failed ❌', err.message || 'Could not resolve', '❌');
  }
};

// ── Scan ───────────────────────────────────────────────────────────────────
window.runAnomalyScan = async function() {
  toast('Scan Running…', 'ML detection in progress', '🔍');
  try {
    const result = await anomalyAPI.scan();
    toast(
      'Scan Complete ✅',
      `Scanned: ${result.scanned_logs} · New: ${result.new_anomalies} · Time: ${result.scan_duration_ms}ms`,
      '✅'
    );
    await loadAnomalies();
  } catch (err) {
    toast('Scan Failed ❌', err.message || 'Backend unreachable', '❌');
  }
};

// ══════════════════════════════════════════════════════
//  FILE UPLOAD — POST /api/logs/upload
//  FIX: Response ab clearly dikhega
// ══════════════════════════════════════════════════════
function initUploadZone() {
  const zone = document.getElementById('upload-zone');
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
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
  const fnEl = document.getElementById('upload-filename');
  const szEl = document.getElementById('upload-size');
  if (fnEl) fnEl.textContent = file.name;
  if (szEl) szEl.textContent = formatBytes(file.size);
  show('upload-preview');
  hide('upload-progress');
}

window.cancelUpload = function() {
  selectedFile = null;
  hide('upload-preview');
  hide('upload-progress');
  hide('upload-result');
  const inp = document.getElementById('file-input');
  if (inp) inp.value = '';
};

// FIX: Upload response clearly dikhao
window.uploadFile = async function() {
  if (!selectedFile) return;

  hide('upload-preview');
  show('upload-progress');

  // Progress bar animate karo
  let pct = 0;
  const bar   = document.getElementById('upload-bar');
  const pctEl = document.getElementById('upload-pct');

  const fakeTimer = setInterval(() => {
    pct = Math.min(pct + 10, 85);
    if (bar)   bar.style.width   = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
  }, 200);

  try {
    // FormData banao — file attach karo
    const formData = new FormData();
    formData.append('file', selectedFile);

    // POST /api/logs/upload
    const result = await logsAPI.uploadLog(formData);

    // Progress 100% karo
    clearInterval(fakeTimer);
    if (bar)   bar.style.width   = '100%';
    if (pctEl) pctEl.textContent = '100%';

    // FIX: Result clearly dikhao
    setTimeout(() => {
      hide('upload-progress');

      // Result box dikhao
      showUploadResult(result);

      // Tables refresh karo
      loadLogs();
      loadAnomalies();

    }, 500);

  } catch (err) {
    clearInterval(fakeTimer);
    hide('upload-progress');
    show('upload-preview');
    toast('Upload Failed ❌', err.message || 'Server error', '❌');
  }
};

// FIX: Upload ka result clearly dikhao
function showUploadResult(result) {
  // Result element dhundo ya banao
  let resultEl = document.getElementById('upload-result');
  if (!resultEl) {
    resultEl = document.createElement('div');
    resultEl.id = 'upload-result';
    const zone = document.getElementById('upload-zone');
    if (zone) zone.parentElement.appendChild(resultEl);
  }

  resultEl.style.display = '';
  resultEl.innerHTML = `
    <div style="margin-top:16px">
      <div class="alert-strip" style="background:rgba(0,245,212,0.08);border:1px solid rgba(0,245,212,0.3);color:var(--success)">
        ✅ Upload Successful!
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">

        <div class="stat-card info" style="padding:14px">
          <div class="stat-label">File Name</div>
          <div style="font-size:12px;font-weight:700;color:var(--info);margin-top:4px">
            ${result.filename || selectedFile?.name || '—'}
          </div>
        </div>

        <div class="stat-card success" style="padding:14px">
          <div class="stat-label">Total Lines</div>
          <div class="stat-value" style="font-size:22px">
            ${(result.total_lines || 0).toLocaleString()}
          </div>
        </div>

        <div class="stat-card info" style="padding:14px">
          <div class="stat-label">Parsed Entries</div>
          <div class="stat-value" style="font-size:22px">
            ${(result.parsed_entries || 0).toLocaleString()}
          </div>
        </div>

        <div class="stat-card warning" style="padding:14px">
          <div class="stat-label">Skipped Lines</div>
          <div class="stat-value" style="font-size:22px">
            ${(result.skipped_lines || 0).toLocaleString()}
          </div>
        </div>

        <div class="stat-card danger" style="padding:14px;grid-column:span 2">
          <div class="stat-label">Anomalies Found</div>
          <div class="stat-value" style="font-size:28px">
            ${(result.anomalies_found || 0).toLocaleString()}
          </div>
        </div>
      </div>

      <button class="btn btn-ghost" style="margin-top:12px;width:100%"
        onclick="window.cancelUpload()">
        Upload Another File
      </button>
    </div>`;

  // Toast bhi dikhao
  toast(
    'Upload Complete ✅',
    `${result.parsed_entries || 0} entries parsed · ${result.anomalies_found || 0} anomalies found`,
    '📂'
  );
}

// ── Network Tab Explain (Step 6) ───────────────────────────────────────────
// Browser mein F12 → Network Tab kholo
// Dashboard refresh karo
// Ye requests dikhni chahiye:
//   GET /api/dashboard/metrics → 200 OK (green)
//   GET /api/anomalies         → 200 OK (green)
// Agar red dikhe → backend se problem hai

// ── Helpers ────────────────────────────────────────────────────────────────
function show(id) {
  const e = document.getElementById(id);
  if (e) e.style.display = '';
}

function hide(id) {
  const e = document.getElementById(id);
  if (e) e.style.display = 'none';
}

function fmtTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toTimeString().slice(0, 8); }
  catch { return '—'; }
}

function timeAgo(iso) {
  if (!iso) return '—';
  try {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    return `${Math.floor(diff / 3600)} hr ago`;
  } catch { return '—'; }
}
