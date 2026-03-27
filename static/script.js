/* ═══════════════════════════════════════════
   Büdcə — script.js  (v4 — yeni dizayn uyğun)
   ═══════════════════════════════════════════ */

const API = '/api';
let currentType = 'income';
let allTx = [];

// ═══════════════════════════════════════════
//  LOGGING
// ═══════════════════════════════════════════

const LOG_KEY  = 'budget_logs';
const MAX_LOGS = 500;

function log(category, event, detail = '', status = 'info') {
  const entry = {
    id: Date.now() + Math.random().toString(36).slice(2, 6),
    ts: new Date().toISOString(),
    category, event, detail, status,
    user: document.getElementById('user-name')?.textContent || '—'
  };
  const logs = getLogs();
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  refreshLogPreview();
}

function getLogs() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); }
  catch { return []; }
}

function clearLogs() {
  if (!confirm('Bütün logları silmək istəyirsiniz?')) return;
  localStorage.removeItem(LOG_KEY);
  renderLogs(); refreshLogPreview();
  toast('Loglar silindi', 'success');
}

function renderLogs() {
  const filter  = document.getElementById('log-filter')?.value || '';
  let   logs    = getLogs();
  if (filter) logs = logs.filter(l => l.category === filter);

  const tbody   = document.getElementById('logs-body');
  const noMsg   = document.getElementById('no-logs');
  const statsEl = document.getElementById('log-stats');
  if (!tbody) return;

  const all = getLogs();
  const counts = { AUTH: 0, TRANSACTION: 0, NAV: 0, ERROR: 0 };
  all.forEach(l => { if (counts[l.category] !== undefined) counts[l.category]++; });
  statsEl.innerHTML = Object.entries(counts).map(([k, v]) =>
    `<span class="log-chip ${k.toLowerCase()}">${k}: ${v}</span>`
  ).join('');

  tbody.innerHTML = '';
  if (logs.length === 0) { noMsg.classList.remove('hidden'); return; }
  noMsg.classList.add('hidden');

  logs.forEach(l => {
    const d    = new Date(l.ts);
    const time = d.toLocaleDateString('az-AZ') + ' ' +
                 d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const tr   = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:12px;color:var(--text3)">${time}</td>
      <td><span class="log-cat-badge ${l.category}">${l.category}</span></td>
      <td style="font-size:13px;font-weight:500">${esc(l.event)}</td>
      <td style="font-size:12px;color:var(--text2)">${esc(l.detail)}</td>
      <td style="font-size:12px;color:var(--text3)">${esc(l.user || '—')}</td>
      <td><span class="status-${l.status}">${l.status.toUpperCase()}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function refreshLogPreview() {
  const el = document.getElementById('log-preview');
  if (!el) return;
  const logs = getLogs().slice(0, 6);
  if (logs.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:13px">Hələ aktivlik yoxdur.</p>';
    return;
  }
  el.innerHTML = logs.map(l => {
    const t = new Date(l.ts).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
    return `<div class="log-item">
      <span class="log-time">${t}</span>
      <span class="log-event">${esc(l.event)}</span>
      <span class="log-cat-badge ${l.category}" style="font-size:9px">${l.category}</span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
//  PAGE LOAD — sessiya yoxlanması
// ═══════════════════════════════════════════

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('f-date').value = today();
  document.getElementById('hdr-date').textContent = new Date().toLocaleDateString('az-AZ', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  log('NAV', 'Tətbiq açıldı', '', 'info');

  try {
    const res = await fetch(`${API}/me`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      log('AUTH', 'Aktiv sessiya', `İstifadəçi: ${data.username}`, 'ok');
      initApp(data.username);
    } else {
      window.location.href = '/login.html';
    }
  } catch (e) {
    log('ERROR', 'Server əlaqəsi yoxdur', e.message, 'error');
    window.location.href = '/login.html';
  }
});

async function initApp(username) {
  document.getElementById('app').classList.add('visible');
  document.getElementById('user-name').textContent = username;
  document.getElementById('user-ava').textContent  = username.charAt(0).toUpperCase();
  await loadBalance();
  await loadTx();
  renderLogs();
  refreshLogPreview();
}

// ═══════════════════════════════════════════
//  LOGOUT
// ═══════════════════════════════════════════

async function doLogout() {
  log('AUTH', 'Çıxış', `İstifadəçi: ${document.getElementById('user-name')?.textContent}`, 'info');
  try { await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' }); } catch (_) {}
  window.location.href = '/login.html';
}

// ═══════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${name}`)?.classList.add('active');
  document.getElementById(`nav-${name}`)?.classList.add('active');
  log('NAV', `Səhifə: ${name}`, '', 'info');
  if (name === 'report')       loadReport();
  if (name === 'logs')         renderLogs();
  if (name === 'transactions') renderTx(allTx);
}

// ═══════════════════════════════════════════
//  BALANCE
// ═══════════════════════════════════════════

async function loadBalance() {
  try {
    const res  = await fetch(`${API}/balance`, { credentials: 'include' });
    if (!res.ok) return;
    const d = await res.json();
    document.getElementById('total-income').textContent  = fmt(d.income);
    document.getElementById('total-expense').textContent = fmt(d.expense);
    document.getElementById('total-balance').textContent = fmt(d.balance);
  } catch (e) { log('ERROR', 'Balans yüklənmədi', e.message, 'error'); }
}

// ═══════════════════════════════════════════
//  TRANSACTIONS
// ═══════════════════════════════════════════

async function loadTx() {
  try {
    const res = await fetch(`${API}/transactions`, { credentials: 'include' });
    if (!res.ok) return;
    allTx = await res.json();
    renderTx(allTx);
    renderRecent(allTx);
  } catch (e) { log('ERROR', 'Əməliyyatlar yüklənmədi', e.message, 'error'); }
}

function renderTx(list) {
  const tbody = document.getElementById('tx-body');
  const noMsg = document.getElementById('no-tx');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!list || list.length === 0) { noMsg?.classList.remove('hidden'); return; }
  noMsg?.classList.add('hidden');
  list.forEach(t => {
    const isI = t.type === 'income';
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.date}</td>
      <td><span class="badge ${isI ? 'badge-income' : 'badge-expense'}">${isI ? '↑ Gəlir' : '↓ Xərc'}</span></td>
      <td>${esc(t.category || '—')}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${esc(t.description || '—')}</td>
      <td class="${isI ? 'amt-income' : 'amt-expense'}" style="font-weight:600">${isI ? '+' : '-'}${fmt(t.amount)}</td>
      <td><button class="del-btn" onclick="deleteTx(${t.id})">Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderRecent(list) {
  const el = document.getElementById('recent-list');
  if (!el) return;
  const recent = (list || []).slice(0, 5);
  if (recent.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:13px">Hələ əməliyyat yoxdur.</p>';
    return;
  }
  el.innerHTML = recent.map(t => {
    const isI = t.type === 'income';
    return `<div class="recent-item">
      <div class="recent-left">
        <div class="recent-dot ${isI ? 'income' : 'expense'}"></div>
        <div>
          <div class="recent-cat">${esc(t.category || '—')}</div>
          <div class="recent-date">${t.date}</div>
        </div>
      </div>
      <span class="${isI ? 'amt-income' : 'amt-expense'}">${isI ? '+' : '-'}${fmt(t.amount)}</span>
    </div>`;
  }).join('');
}

function filterTx() {
  const q    = (document.getElementById('search-inp')?.value || '').toLowerCase();
  const type = document.getElementById('filter-type')?.value || '';
  let filtered = allTx;
  if (type) filtered = filtered.filter(t => t.type === type);
  if (q)    filtered = filtered.filter(t =>
    (t.category || '').toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q) ||
    (t.date || '').includes(q)
  );
  renderTx(filtered);
}

async function addTx() {
  const amount = document.getElementById('f-amount').value;
  const date   = document.getElementById('f-date').value;
  const cat    = document.getElementById('f-cat').value;
  const desc   = document.getElementById('f-desc').value.trim();
  const msgEl  = document.getElementById('form-msg');

  if (!amount || !date) { showMsg(msgEl, 'Məbləğ və tarix tələb olunur', 'var(--expense)'); return; }

  const url = currentType === 'income' ? `${API}/income` : `${API}/expense`;
  try {
    const res  = await fetch(url, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), date, category: cat, description: desc })
    });
    const data = await res.json();
    if (res.ok) {
      log('TRANSACTION', `${currentType === 'income' ? 'Gəlir' : 'Xərc'} əlavə edildi`,
          `${fmt(parseFloat(amount))} — ${cat}`, 'ok');
      showMsg(msgEl, '✓ ' + data.message, 'var(--income)');
      toast(data.message, 'success');
      document.getElementById('f-amount').value = '';
      document.getElementById('f-desc').value   = '';
      document.getElementById('f-cat').value    = '';
      document.getElementById('f-date').value   = today();
      await loadBalance(); await loadTx();
    } else {
      log('TRANSACTION', 'Xəta', data.error || '', 'error');
      showMsg(msgEl, data.error || 'Xəta baş verdi', 'var(--expense)');
    }
  } catch (e) {
    log('ERROR', 'API xətası', e.message, 'error');
    showMsg(msgEl, 'Server ilə əlaqə qurulmadı', 'var(--expense)');
  }
}

async function deleteTx(id) {
  if (!confirm('Silmək istəyirsiniz?')) return;
  try {
    const res = await fetch(`${API}/transaction/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      log('TRANSACTION', 'Silindi', `ID: ${id}`, 'ok');
      toast('Silindi', 'success');
      await loadBalance(); await loadTx();
    }
  } catch (e) { log('ERROR', 'Silmə xətası', e.message, 'error'); }
}

// ═══════════════════════════════════════════
//  REPORT
// ═══════════════════════════════════════════

async function loadReport() {
  try {
    const res  = await fetch(`${API}/report/monthly`, { credentials: 'include' });
    if (!res.ok) return;
    const list = await res.json();
    const tbody = document.getElementById('report-body');
    const noMsg = document.getElementById('no-report');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (list.length === 0) { noMsg?.classList.remove('hidden'); return; }
    noMsg?.classList.add('hidden');
    list.forEach(r => {
      const q  = r.income - r.expense;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600">${r.month}</td>
        <td class="amt-income">+${fmt(r.income)}</td>
        <td class="amt-expense">-${fmt(r.expense)}</td>
        <td style="font-weight:700;color:${q >= 0 ? 'var(--income)' : 'var(--expense)'}">${fmt(q)}</td>
      `;
      tbody.appendChild(tr);
    });
    log('NAV', 'Hesabat yükləndi', `${list.length} ay`, 'info');
  } catch (e) { log('ERROR', 'Hesabat yüklənmədi', e.message, 'error'); }
}

// ═══════════════════════════════════════════
//  TYPE TOGGLE
// ═══════════════════════════════════════════

function setType(type) {
  currentType = type;
  document.getElementById('btn-income').className  = 'type-btn' + (type === 'income'  ? ' income-on'  : '');
  document.getElementById('btn-expense').className = 'type-btn' + (type === 'expense' ? ' expense-on' : '');
}

// ═══════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════

function fmt(v)  { return parseFloat(v).toFixed(2) + ' ₼'; }
function today() { return new Date().toISOString().split('T')[0]; }

function showMsg(el, msg, color) {
  if (!el) return;
  el.style.color = color; el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 3500);
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = type;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}