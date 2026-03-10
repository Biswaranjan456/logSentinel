/**
 * js/api.js — Shared API call functions
 * Used by both dashboard.js and logs.js
 */

const API_URL = 'http://localhost:5000/api';

// ── Core fetch helper ──────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };
  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new APIError(res.status, err.message || res.statusText, err);
    }
    if (res.status === 204) return null;
    return await res.json();
  } catch (e) {
    if (e instanceof APIError) throw e;
    throw new APIError(0, 'Network error — server unreachable', {});
  }
}

class APIError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

const api = {
  get   : (ep, opts = {})        => apiFetch(ep, { method: 'GET', ...opts }),
  post  : (ep, body, opts = {})  => apiFetch(ep, { method: 'POST',   body: JSON.stringify(body), ...opts }),
  put   : (ep, body, opts = {})  => apiFetch(ep, { method: 'PUT',    body: JSON.stringify(body), ...opts }),
  delete: (ep, opts = {})        => apiFetch(ep, { method: 'DELETE', ...opts }),
  upload: (ep, formData)         => apiFetch(ep, { method: 'POST', body: formData, headers: {} }),
};

// ── Endpoint modules ───────────────────────────────────────────────────────
const dashboardAPI = {
  getStats  : ()  => api.get('/dashboard/stats'),
  getMetrics: ()  => api.get('/dashboard/metrics'),
  triggerScan: () => api.post('/anomalies/scan'),
};

const logsAPI = {
  getLogs   : (params = {}) => api.get(`/logs?${new URLSearchParams(params)}`),
  uploadLog : (fd)           => api.upload('/logs/upload', fd),
  processLog: (id)           => api.post(`/logs/${id}/process`),
  deleteLog : (id)           => api.delete(`/logs/${id}`),
};

const anomalyAPI = {
  getAll  : (params = {}) => api.get(`/anomalies?${new URLSearchParams(params)}`),
  getOne  : (id)           => api.get(`/anomalies/${id}`),
  resolve : (id, note = '') => api.put(`/anomalies/${id}/resolve`, { note }),
  scan    : ()             => api.post('/anomalies/scan'),
};

// ── Mock Data ──────────────────────────────────────────────────────────────
const MOCK = {
  stats: {
    totalLogs: 148234,
    anomalies: 27,
    criticalAlerts: 4,
    systemHealth: 94,
    logsPerMin: 312,
    resolvedToday: 11,
  },
  anomalies: [
    { id: 1, name: 'Brute Force Attempt',      severity: 'critical', source: 'auth-service',   time: '2 min ago',  count: 847  },
    { id: 2, name: 'Unusual Traffic Spike',    severity: 'high',     source: 'api-gateway',    time: '8 min ago',  count: 12400},
    { id: 3, name: 'Memory Leak Detected',     severity: 'medium',   source: 'node-service',   time: '15 min ago', count: 3    },
    { id: 4, name: 'Slow Query Performance',   severity: 'medium',   source: 'db-cluster',     time: '22 min ago', count: 156  },
    { id: 5, name: 'SSL Certificate Expiring', severity: 'low',      source: 'cert-manager',   time: '1 hr ago',   count: 1    },
    { id: 6, name: 'DDoS Pattern Detected',    severity: 'critical', source: 'firewall',        time: '3 min ago',  count: 42100},
    { id: 7, name: 'Failed Login Flood',       severity: 'high',     source: 'auth-service',   time: '11 min ago', count: 2310 },
    { id: 8, name: 'Disk I/O Anomaly',         severity: 'medium',   source: 'storage-svc',    time: '30 min ago', count: 88   },
  ],
  logMessages: [
    { level: 'INFO',  source: 'api-gateway',    message: 'Health check passed — all services nominal' },
    { level: 'WARN',  source: 'disk-monitor',   message: 'Disk usage at 71% on /var/log partition' },
    { level: 'ERROR', source: 'auth-service',   message: 'JWT verification failed — expired token for uid:9182' },
    { level: 'INFO',  source: 'cache-layer',    message: 'Evicted 1,240 stale keys from Redis cluster' },
    { level: 'WARN',  source: 'rate-limiter',   message: 'IP 10.0.0.99 flagged — 512 req/min threshold exceeded' },
    { level: 'DEBUG', source: 'log-processor',  message: 'Pattern match scan completed in 85ms — 0 new hits' },
    { level: 'ERROR', source: 'ml-detector',    message: 'Confidence score 0.97 — anomaly confirmed [cluster-3]' },
    { level: 'INFO',  source: 'db-connector',   message: 'Connection pool restored — 10/10 connections active' },
    { level: 'WARN',  source: 'memory-monitor', message: 'Heap usage at 78% — approaching threshold (85%)' },
    { level: 'ERROR', source: 'firewall',        message: 'Blocked 4,210 requests from subnet 185.220.0.0/16' },
  ],
};

// ── Live log ticker (SSE mock) ─────────────────────────────────────────────
function startLiveLogs(onLog) {
  let idx = 0;
  return setInterval(() => {
    const base = MOCK.logMessages[idx % MOCK.logMessages.length];
    const now  = new Date();
    onLog({ ...base, time: now.toTimeString().slice(0, 8), id: Date.now() });
    idx++;
  }, 2000);
}

// ── Shared utility ─────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toast(title, msg, icon = 'ℹ️') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div>
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.cssText = 'opacity:0;transform:translateX(20px);transition:all .3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}
