/**
 * js/settings.js — Settings Page Logic
 */

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  renderRulesTable();
  animateProgressBars();
});

// ── Clock ──────────────────────────────────────────────────────────────────
function initClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const tick = () => { el.textContent = new Date().toTimeString().slice(0, 8); };
  tick();
  setInterval(tick, 1000);
}

// ── Tab Switching ──────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));

  const btn = document.querySelector(`.settings-tab[onclick="switchTab('${name}')"]`);
  const panel = document.getElementById(`tab-${name}`);
  if (btn)   btn.classList.add('active');
  if (panel) panel.classList.add('active');

  if (name === 'storage') animateProgressBars();
}

// ── Progress Bars Animate ──────────────────────────────────────────────────
function animateProgressBars() {
  setTimeout(() => {
    document.querySelectorAll('.progress-fill[data-width]').forEach(bar => {
      bar.style.width = `${bar.dataset.width}%`;
    });
  }, 100);
}

// ── Detection Rules Table ──────────────────────────────────────────────────
const rules = [
  { id: 1, name: 'Brute Force Login',      pattern: 'failed_login > 10/min',    severity: 'critical', source: 'auth-service',  active: true  },
  { id: 2, name: 'High Error Rate',        pattern: 'error_rate > 50/min',      severity: 'high',     source: 'All',           active: true  },
  { id: 3, name: 'Memory Threshold',       pattern: 'heap_usage > 85%',         severity: 'medium',   source: 'node-service',  active: true  },
  { id: 4, name: 'Slow DB Queries',        pattern: 'query_time > 2000ms',      severity: 'medium',   source: 'db-connector',  active: false },
  { id: 5, name: 'Rate Limit Exceeded',    pattern: 'requests > 512/min (IP)',   severity: 'high',     source: 'rate-limiter',  active: true  },
  { id: 6, name: 'SSL Cert Expiry',        pattern: 'cert_days_remaining < 14', severity: 'low',      source: 'cert-manager',  active: true  },
];

const sevPillMap = {
  critical: 'pill-danger',
  high    : 'pill-warning',
  medium  : 'pill-info',
  low     : 'pill-success',
};

function renderRulesTable() {
  const tbody = document.getElementById('rules-tbody');
  if (!tbody) return;

  tbody.innerHTML = rules.map(r => `
    <tr>
      <td style="font-weight:700;font-size:12px">${r.name}</td>
      <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted)">${r.pattern}</td>
      <td><span class="pill ${sevPillMap[r.severity]}">${r.severity.toUpperCase()}</span></td>
      <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--info)">${r.source}</td>
      <td>
        <label class="toggle-switch" style="width:40px;height:22px">
          <input type="checkbox" ${r.active ? 'checked' : ''} onchange="toggleRule(${r.id}, this.checked)"/>
          <span class="toggle-track"></span>
        </label>
      </td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" style="font-size:10px;padding:4px 8px" onclick="editRule(${r.id})">Edit</button>
          <button class="btn btn-danger" style="font-size:10px;padding:4px 8px" onclick="deleteRule(${r.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function toggleRule(id, active) {
  const rule = rules.find(r => r.id === id);
  if (!rule) return;
  rule.active = active;
  toast(
    active ? 'Rule Enabled' : 'Rule Disabled',
    `"${rule.name}" is now ${active ? 'active' : 'inactive'}`,
    active ? '✅' : '⏸'
  );
}

function editRule(id) {
  const rule = rules.find(r => r.id === id);
  if (!rule) return;
  toast('Edit Rule', `Editing: "${rule.name}" — form coming soon`, '✏️');
}

function deleteRule(id) {
  const idx = rules.findIndex(r => r.id === id);
  if (idx === -1) return;
  const name = rules[idx].name;
  rules.splice(idx, 1);
  renderRulesTable();
  toast('Rule Deleted', `"${name}" has been removed`, '🗑️');
}

function addRule() {
  toast('Add Rule', 'Rule builder form — coming soon', '➕');
}

// ── Save Handlers ──────────────────────────────────────────────────────────
function saveDetection() {
  const sensitivity = document.getElementById('sensitivity')?.value;
  const confidence  = document.getElementById('confidence')?.value;
  const interval    = document.getElementById('scan-interval')?.value;

  // Real: await settingsAPI.updateSettings({ sensitivity, confidence, interval });
  setSaveMsg('detection-save-msg', 'All changes saved', true);
  toast('Detection Settings Saved', `Sensitivity: ${sensitivity}, Confidence: ${confidence}%`, '✅');
}

function resetDetection() {
  const s = document.getElementById('sensitivity');
  const c = document.getElementById('confidence');
  if (s) { s.value = 7;  document.getElementById('sensitivity-val').textContent = '7'; }
  if (c) { c.value = 85; document.getElementById('confidence-val').textContent = '85%'; }
  toast('Detection Reset', 'Default values restored', '↺');
}

function saveThresholds() {
  toast('Thresholds Saved', 'Alert thresholds updated successfully', '✅');
}

function resetThresholds() {
  const fields = { 'thresh-critical': 100, 'thresh-high': 50, 'thresh-rate': 512 };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  toast('Thresholds Reset', 'Default values restored', '↺');
}

function saveNotifications() {
  toast('Notification Settings Saved', 'Alert rules and delivery config updated', '✅');
}

function saveIntegrations() {
  toast('Integrations Saved', 'Webhook endpoints and API keys updated', '✅');
}

function saveStorage() {
  toast('Storage Policy Saved', 'Log retention rules have been updated', '✅');
}

function saveAll() {
  toast('All Settings Saved', 'Every configuration panel has been saved', '✅');
}

function resetAll() {
  toast('Settings Reset', 'All panels restored to default values', '↺');
}

// ── Notification Toggle ────────────────────────────────────────────────────
function onToggle(cb, type) {
  toast(
    cb.checked ? 'Notification Enabled' : 'Notification Disabled',
    `${type} alerts ${cb.checked ? 'will now fire' : 'are now muted'}`,
    cb.checked ? '🔔' : '🔕'
  );
}

// ── Integrations ───────────────────────────────────────────────────────────
function testSlack() {
  toast('Slack Test', 'Sending test message to #security-alerts…', '💬');
  setTimeout(() => toast('Slack Connected', 'Test message delivered successfully', '✅'), 1800);
}

function testWebhooks() {
  toast('Testing Webhooks', 'Pinging all registered endpoints…', '🔗');
  setTimeout(() => toast('Webhooks OK', '2/3 endpoints responded successfully', '✅'), 2000);
}

function generateKey() {
  const newKey = 'sk-new-' + Math.random().toString(36).slice(2, 18);
  toast('API Key Generated', newKey, '🔑');
}

function toggleKey(id) {
  const inp = document.getElementById(id);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function revokeKey(env) {
  toast('Key Revoked', `${env} API key has been invalidated`, '🗑️');
}

function addWebhook() {
  toast('Add Webhook', 'Webhook builder — coming soon', '➕');
}

// ── Users ──────────────────────────────────────────────────────────────────
function inviteUser() {
  toast('Invite User', 'Email invite form — coming soon', '✉️');
}

// ── Helper ─────────────────────────────────────────────────────────────────
function setSaveMsg(id, msg, success = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('saved', success);
  if (success) setTimeout(() => {
    el.textContent = 'All saved';
  }, 3000);
}
