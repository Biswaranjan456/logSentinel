/**
 * js/dashboard.js — Dashboard Logic & Charts
 * Handles: stats, bar chart, donut, anomaly list, source health
 */

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  loadDashboardStats();
  renderVolumeChart();
  renderAnomalyList();
  renderSourceHealth();
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

// ── Load Stats ─────────────────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    // Attempt real API — falls back to mock
    const data = await dashboardAPI.getStats().catch(() => MOCK.stats);
    renderStats(data);
  } catch {
    renderStats(MOCK.stats);
  }
}

function renderStats(data) {
  animateCounter('stat-total',    data.totalLogs,     true);
  animateCounter('stat-anomaly',  data.anomalies);
  animateCounter('stat-critical', data.criticalAlerts);
  setText('stat-health', `${data.systemHealth}%`);

  // Update badge
  const badge = document.getElementById('anomaly-badge');
  if (badge) badge.textContent = data.criticalAlerts;
}

function animateCounter(id, target, format = false) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = 0;
  const dur   = 1200;
  const step  = 16;
  const steps = dur / step;
  let   curr  = 0;
  const inc   = target / steps;
  const timer = setInterval(() => {
    curr = Math.min(curr + inc, target);
    el.textContent = format
      ? Math.floor(curr).toLocaleString()
      : Math.floor(curr);
    if (curr >= target) clearInterval(timer);
  }, step);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Volume Chart (24h bar chart) ───────────────────────────────────────────
function renderVolumeChart(period = 'Hourly') {
  const chart = document.getElementById('volume-chart');
  if (!chart) return;
  chart.innerHTML = '';

  const count = period === 'Hourly' ? 24 : period === '6-Hour' ? 28 : 30;
  const data  = Array.from({ length: count }, () => ({
    val    : Math.floor(Math.random() * 80 + 15),
    anomaly: Math.random() > 0.82,
  }));
  const max = Math.max(...data.map(d => d.val));

  data.forEach((d, i) => {
    const bar = document.createElement('div');
    bar.className = `bar${d.anomaly ? ' danger' : ''}`;
    bar.style.height    = '0%';
    bar.style.transition = `height ${0.4 + i * 0.015}s ease`;
    bar.title = `${d.val} logs${d.anomaly ? ' ⚠ Anomaly' : ''}`;
    chart.appendChild(bar);
    // Animate in
    requestAnimationFrame(() => {
      setTimeout(() => {
        bar.style.height = `${(d.val / max) * 100}%`;
      }, 50 + i * 10);
    });
  });

  // Labels
  const labels = document.getElementById('chart-labels');
  if (!labels) return;
  if (period === 'Hourly') {
    labels.innerHTML = ['00:00','04:00','08:00','12:00','16:00','20:00','24:00']
      .map(t => `<span>${t}</span>`).join('');
  } else {
    labels.innerHTML = '';
  }
}

window.updateChart = function(period) {
  renderVolumeChart(period);
};

// ── Anomaly List ───────────────────────────────────────────────────────────
function renderAnomalyList() {
  const el = document.getElementById('dashboard-anomalies');
  if (!el) return;

  const items = MOCK.anomalies.slice(0, 4);
  el.innerHTML = items.map(a => `
    <div class="anomaly-item">
      <span class="anomaly-severity sev-${a.severity}">${a.severity.toUpperCase()}</span>
      <div class="anomaly-info">
        <div class="anomaly-name">${a.name}</div>
        <div class="anomaly-meta">${a.source} · ${a.time} · ${a.count.toLocaleString()} events</div>
      </div>
    </div>
  `).join('');
}

// ── Source Health Progress Bars ────────────────────────────────────────────
function renderSourceHealth() {
  const el = document.getElementById('source-health');
  if (!el) return;

  const sources = [
    { name: 'api-gateway',  pct: 98, color: 'var(--success)' },
    { name: 'auth-service', pct: 72, color: 'var(--warning)' },
    { name: 'db-connector', pct: 85, color: 'var(--info)'    },
    { name: 'rate-limiter', pct: 91, color: 'var(--success)' },
    { name: 'ml-detector',  pct: 45, color: 'var(--danger)'  },
  ];

  el.innerHTML = sources.map(s => `
    <div class="progress-item">
      <div class="progress-label">
        <span>${s.name}</span>
        <span>${s.pct}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:0%;background:${s.color}"
          data-target="${s.pct}"></div>
      </div>
    </div>
  `).join('');

  // Animate bars
  setTimeout(() => {
    el.querySelectorAll('.progress-fill').forEach(bar => {
      bar.style.width = `${bar.dataset.target}%`;
    });
  }, 100);
}

// ── Scan ───────────────────────────────────────────────────────────────────
window.triggerScan = async function() {
  const btn = document.getElementById('scan-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Scanning…'; }
  toast('Scan Started', 'ML anomaly detection scan running…', '🔍');

  try {
    await dashboardAPI.triggerScan().catch(() => {});
  } finally {
    setTimeout(() => {
      toast('Scan Complete', `${MOCK.anomalies.length} patterns analysed`, '✅');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Run Scan`;
      }
    }, 2800);
  }
};

// ── Auto refresh stats every 30s ───────────────────────────────────────────
function startAutoRefresh() {
  setInterval(() => {
    loadDashboardStats();
  }, 30000);
}
