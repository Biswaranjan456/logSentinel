/**
 * js/dashboard.js — Dashboard Logic & Charts
 * Fixed: NaN, undefined, field name mapping
 */

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  loadDashboardData();
  startAutoRefresh();
});

// ── Clock ──────────────────────────────────────────────────────────────────
function initClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const tick = () => { el.textContent = new Date().toTimeString().slice(0, 8); };
  tick();
  setInterval(tick, 1000);
}

// ── Main Loader ────────────────────────────────────────────────────────────
async function loadDashboardData() {
  try {
    const metrics = await dashboardAPI.getMetrics();
    console.log('API Response:', metrics); // Debug ke liye

    // FastAPI se aata hai: metrics.stats ke andar data hota hai
    const stats = metrics.stats || metrics; // dono case handle
    renderStats(stats);
    renderVolumeChartFromAPI(metrics.volume_chart);
    renderDonut(metrics.level_dist);
    renderSourceHealth(metrics.source_health);
    updateCriticalAlert(stats.critical_alerts);
    await loadAnomalyList();

  } catch (err) {
    console.warn('Backend error:', err.message);
    // Mock data use karo jab backend offline ho
    renderStats(MOCK.stats);
    renderVolumeChartMock();
    renderSourceHealthMock();
    renderAnomalyListMock();
  }
}

// ── Stats Cards ────────────────────────────────────────────────────────────
// FastAPI field names: total_logs, anomalies, critical_alerts, system_health
// Mock field names:    totalLogs,  anomalies, criticalAlerts,  systemHealth
function renderStats(data) {
  if (!data) return;

  // Dono field names handle karo — FastAPI aur Mock dono ke liye
  const totalLogs     = data.total_logs     ?? data.totalLogs     ?? 0;
  const anomalies     = data.anomalies      ?? 0;
  const criticalAlert = data.critical_alerts ?? data.criticalAlerts ?? 0;
  const systemHealth  = data.system_health  ?? data.systemHealth  ?? 0;

  console.log('Stats:', { totalLogs, anomalies, criticalAlert, systemHealth }); // Debug

  animateCounter('stat-total',    totalLogs,     true);
  animateCounter('stat-anomaly',  anomalies);
  animateCounter('stat-critical', criticalAlert);
  setText('stat-health', `${Math.round(systemHealth)}%`);

  const badge = document.getElementById('anomaly-badge');
  if (badge) badge.textContent = criticalAlert || '0';
}

function updateCriticalAlert(count) {
  const strip = document.getElementById('critical-alert');
  if (!strip) return;
  const c = count || 0;
  if (c === 0) {
    strip.style.display = 'none';
  } else {
    strip.style.display = '';
    const strong = strip.querySelector('strong');
    if (strong) strong.textContent = `${c} CRITICAL ANOMALIES`;
  }
}

// ── Volume Chart ───────────────────────────────────────────────────────────
function renderVolumeChartFromAPI(volumeData) {
  const chart = document.getElementById('volume-chart');
  if (!chart) return;

  // Agar API se data nahi aaya to mock use karo
  if (!volumeData || !volumeData.length) {
    renderVolumeChartMock();
    return;
  }

  chart.innerHTML = '';
  const max = Math.max(...volumeData.map(d => d.count || 0), 1);

  volumeData.forEach((d, i) => {
    const bar = document.createElement('div');
    bar.className    = `bar${d.anomaly ? ' danger' : ''}`;
    bar.style.height = '0%';
    bar.style.transition = `height ${0.4 + i * 0.015}s ease`;
    bar.title = `${String(d.hour).padStart(2,'0')}:00 — ${d.count} logs${d.anomaly ? ' ⚠' : ''}`;
    chart.appendChild(bar);
    requestAnimationFrame(() => {
      setTimeout(() => {
        bar.style.height = `${((d.count || 0) / max) * 100}%`;
      }, 50 + i * 10);
    });
  });

  const labels = document.getElementById('chart-labels');
  if (labels) {
    labels.innerHTML = ['00:00','04:00','08:00','12:00','16:00','20:00','24:00']
      .map(t => `<span>${t}</span>`).join('');
  }
}

function renderVolumeChartMock() {
  const chart = document.getElementById('volume-chart');
  if (!chart) return;
  chart.innerHTML = '';

  const data = Array.from({ length: 24 }, () => ({
    count  : Math.floor(Math.random() * 80 + 15),
    anomaly: Math.random() > 0.82,
  }));
  const max = Math.max(...data.map(d => d.count));

  data.forEach((d, i) => {
    const bar = document.createElement('div');
    bar.className = `bar${d.anomaly ? ' danger' : ''}`;
    bar.style.height = '0%';
    bar.style.transition = `height ${0.4 + i * 0.015}s ease`;
    chart.appendChild(bar);
    requestAnimationFrame(() => {
      setTimeout(() => { bar.style.height = `${(d.count / max) * 100}%`; }, 50 + i * 10);
    });
  });

  const labels = document.getElementById('chart-labels');
  if (labels) {
    labels.innerHTML = ['00:00','04:00','08:00','12:00','16:00','20:00','24:00']
      .map(t => `<span>${t}</span>`).join('');
  }
}

window.updateChart = function() { loadDashboardData(); };

// ── Donut Chart ────────────────────────────────────────────────────────────
function renderDonut(levelDist) {
  if (!levelDist) return;

  const total = Object.values(levelDist).reduce((a, b) => a + b, 0) || 1;

  const center = document.querySelector('.donut-center');
  if (center) {
    center.textContent = total > 999
      ? `${(total / 1000).toFixed(0)}K`
      : total;
  }

  const keys = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
  document.querySelectorAll('.legend-val').forEach((el, i) => {
    if (keys[i]) {
      const pct = Math.round(((levelDist[keys[i]] || 0) / total) * 100);
      el.textContent = `${pct}%`;
    }
  });
}

// ── Anomaly List ───────────────────────────────────────────────────────────
async function loadAnomalyList() {
  const el = document.getElementById('dashboard-anomalies');
  if (!el) return;

  try {
    const res   = await anomalyAPI.getAll({ limit: 4, status: 'open' });
    const items = res.data || [];

    if (!items.length) {
      el.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">No open anomalies 🎉</div>';
      return;
    }

    el.innerHTML = items.map(a => `
      <div class="anomaly-item">
        <span class="anomaly-severity sev-${a.severity}">${a.severity.toUpperCase()}</span>
        <div class="anomaly-info">
          <div class="anomaly-name">${a.name}</div>
          <div class="anomaly-meta">
            ${a.source} · ${timeAgo(a.detected_at)} · ${(a.event_count || 0).toLocaleString()} events
          </div>
        </div>
      </div>`).join('');

  } catch {
    renderAnomalyListMock();
  }
}

function renderAnomalyListMock() {
  const el = document.getElementById('dashboard-anomalies');
  if (!el) return;
  el.innerHTML = MOCK.anomalies.slice(0, 4).map(a => `
    <div class="anomaly-item">
      <span class="anomaly-severity sev-${a.severity}">${a.severity.toUpperCase()}</span>
      <div class="anomaly-info">
        <div class="anomaly-name">${a.name}</div>
        <div class="anomaly-meta">${a.source} · ${a.time} · ${a.count.toLocaleString()} events</div>
      </div>
    </div>`).join('');
}

// ── Source Health ──────────────────────────────────────────────────────────
function renderSourceHealth(sourceHealth) {
  const el = document.getElementById('source-health');
  if (!el || !sourceHealth) {
    renderSourceHealthMock();
    return;
  }

  const colorFor = pct =>
    pct >= 90 ? 'var(--success)' :
    pct >= 70 ? 'var(--warning)' :
    pct >= 50 ? 'var(--info)'    : 'var(--danger)';

  el.innerHTML = Object.entries(sourceHealth).map(([name, pct]) => `
    <div class="progress-item">
      <div class="progress-label">
        <span>${name}</span><span>${Math.round(pct)}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" data-target="${pct}"
          style="width:0%;background:${colorFor(pct)}"></div>
      </div>
    </div>`).join('');

  setTimeout(() => {
    el.querySelectorAll('.progress-fill').forEach(b => {
      b.style.width = `${b.dataset.target}%`;
    });
  }, 100);
}

function renderSourceHealthMock() {
  renderSourceHealth({
    'api-gateway' : 98,
    'auth-service': 72,
    'db-connector': 85,
    'rate-limiter': 91,
    'ml-detector' : 45,
  });
}

// ── Scan ───────────────────────────────────────────────────────────────────
window.triggerScan = async function() {
  const btn = document.getElementById('scan-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Scanning…'; }
  toast('Scan Started', 'ML anomaly detection scan running…', '🔍');

  try {
    const result = await dashboardAPI.triggerScan();
    toast(
      'Scan Complete',
      `${result.scanned_logs || 0} logs · ${result.new_anomalies || 0} new anomalies · ${result.scan_duration_ms || 0}ms`,
      '✅'
    );
    await loadDashboardData();
  } catch (err) {
    toast('Scan Failed', err.message || 'Backend unreachable', '❌');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg> Run Scan`;
    }
  }
};

// ── Auto Refresh ───────────────────────────────────────────────────────────
function startAutoRefresh() {
  setInterval(loadDashboardData, 30000);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function animateCounter(id, target = 0, format = false) {
  const el = document.getElementById(id);
  if (!el) return;
  const safeTarget = isNaN(target) ? 0 : Number(target);
  let curr = 0;
  const inc = safeTarget / 75;
  const timer = setInterval(() => {
    curr = Math.min(curr + inc, safeTarget);
    el.textContent = format
      ? Math.floor(curr).toLocaleString()
      : Math.floor(curr);
    if (curr >= safeTarget) clearInterval(timer);
  }, 16);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val || '0';
}

function showLoading(on) {
  const title = document.querySelector('.page-title');
  if (title) title.style.opacity = on ? '0.5' : '1';
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return `${Math.floor(diff / 3600)} hr ago`;
}
