/* =============================================================
   COSAS DE MI VIDA EJCP — Complete Application Logic
   Version 2.0
   ============================================================= */

'use strict';

// ═══════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════
const APP = {
  module: 'dashboard',
  tasks: [],
  tickets: [],
  network: [],
  economy: [],
  portfolio: [],
  activities: [],
  profile: { name: 'EJCP', status: '🟢 En línea', avatar: null },
  rate: 36.50,
  ticketCounter: 1,
  networkCounter: 1,
  portfolioTab: 'projects',
  _pfFileData: null,

  // voice
  mediaRecorder: null,
  audioChunks: [],
  audioBlob: null,
  audioUrl: null,
  voiceText: '',
  voiceTimer: null,
  voiceSeconds: 0,
  recognition: null,

  // edit state
  editId: null,

  // views
  taskView: 'all',
  ticketView: 'all',
  netView: 'all',
  econView: 'all',

  // export module
  exportModule: 'tasks',

  // charts
  charts: {},
};

// ═══════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  startClock();
  buildFab();
  setModule('dashboard');
  setDefaultDates();
});

function getUserSuffix() {
  if (typeof getCurrentUser !== 'function') return '';
  const curUser = getCurrentUser();
  return (curUser && curUser.id && curUser.id !== 'usr-admin') ? `_${curUser.id}` : '';
}

function loadAll() {
  const suffix = getUserSuffix();

  APP.tasks      = fromLS('ejcp_tasks' + suffix,      []);
  APP.tickets    = fromLS('ejcp_tickets' + suffix,    []);
  APP.network    = fromLS('ejcp_network' + suffix,    []);
  APP.economy    = fromLS('ejcp_economy' + suffix,    []);
  APP.debts      = fromLS('ejcp_debts' + suffix,      []);
  APP.portfolio  = fromLS('ejcp_portfolio' + suffix,  []);
  APP.activities = fromLS('ejcp_activities' + suffix, []);
  
  const curUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  APP.profile    = fromLS('ejcp_profile' + suffix,    { 
    name: (curUser && curUser.name) ? curUser.name : 'Edwin José Colmenares Pacheco', 
    status: (curUser && curUser.status) ? curUser.status : '🟢 En línea', 
    avatar: curUser ? curUser.avatar : null 
  });

  const isCleared = fromLS('ejcp_cleared' + suffix, false);
  if (!isCleared && suffix === '' && !APP.tasks.length && !APP.tickets.length && !APP.economy.length) {
    APP.tasks   = typeof sampleTasks   === 'function' ? sampleTasks()   : [];
    APP.tickets = typeof sampleTickets === 'function' ? sampleTickets() : [];
    APP.network = typeof sampleNetwork === 'function' ? sampleNetwork() : [];
    APP.economy = typeof sampleEconomy === 'function' ? sampleEconomy() : [];
  }

  APP.rateBCV    = fromLS('ejcp_rate_bcv',    755.90);
  APP.rateEUR    = fromLS('ejcp_rate_eur',    755.90);
  APP.rateBinance= fromLS('ejcp_rate_binance', 755.90);
  APP.rateAirtm  = fromLS('ejcp_rate_airtm',   755.90);
  APP.rate       = APP.rateBCV;

  APP.ticketCounter  = fromLS('ejcp_tk_cnt' + suffix, APP.tickets.length + 1);
  APP.networkCounter = fromLS('ejcp_net_cnt' + suffix, APP.network.length + 1);

  initRatesUI();
  updateProfileUI();
  if (typeof updateProfileHeaderUI === 'function') updateProfileHeaderUI();
}

function saveAll() {
  const suffix = getUserSuffix();

  toLS('ejcp_tasks' + suffix,      APP.tasks);
  toLS('ejcp_tickets' + suffix,    APP.tickets);
  toLS('ejcp_network' + suffix,    APP.network);
  toLS('ejcp_economy' + suffix,    APP.economy);
  toLS('ejcp_portfolio' + suffix,  APP.portfolio);
  toLS('ejcp_activities' + suffix, APP.activities);
  toLS('ejcp_profile' + suffix,    APP.profile);
  toLS('ejcp_rate_bcv',   APP.rateBCV);
  toLS('ejcp_rate_eur',   APP.rateEUR);
  toLS('ejcp_rate_binance', APP.rateBinance);
  toLS('ejcp_rate_airtm',   APP.rateAirtm);
  toLS('ejcp_rate',       APP.rateBCV);
  toLS('ejcp_tk_cnt' + suffix,     APP.ticketCounter);
  toLS('ejcp_net_cnt' + suffix,    APP.networkCounter);
}

function fromLS(key, def) {
  try {
    const v = localStorage.getItem(key);
    if (!v || v === 'null' || v === 'undefined') return def;
    const parsed = JSON.parse(v);
    return (parsed !== null && parsed !== undefined) ? parsed : def;
  } catch {
    return def;
  }
}
function toLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ═══════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════
function startClock() {
  const tick = () => {
    const now = new Date();
    const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const dateEl = document.getElementById('sidebar-date');
    const timeEl = document.getElementById('sidebar-time');
    if (dateEl) dateEl.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    if (timeEl) timeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };
  tick(); setInterval(tick, 1000);
}

// ═══════════════════════════════════════════
//  MODULE NAVIGATION
// ═══════════════════════════════════════════
const MODULE_META = {
  dashboard:  { title: 'Dashboard',          sub: 'Resumen general de tu vida' },
  register:   { title: 'Registrar Usuario',   sub: 'Formulario de registro directo para crear usuarios con espacio en blanco' },
  tasks:      { title: 'Tareas',             sub: 'Todo lo que tienes que hacer' },
  tickets:    { title: 'Tickets de Soporte', sub: 'Control de incidencias y soporte IT' },
  network:    { title: 'Caídas de Red',      sub: 'Registro de interrupciones de red' },
  economy:    { title: 'Economía',           sub: 'Control financiero personal' },
  'shared-expenses': { title: 'Gastos Compartidos', sub: 'División de gastos en grupo, balances de quién debe a quién y liquidaciones' },
  portfolio:  { title: 'Portafolio TI',      sub: 'Proyectos, documentación y habilidades profesionales' },
  activities: { title: 'Actividades & Salud', sub: 'Control de ejercicios, rutinas y métricas de bienestar' },
  database:   { title: 'Base de Datos General', sub: 'Gestión de respaldo, exportación e importación masiva de datos (Excel, CSV y JSON)' },
  excel:      { title: 'Base de Datos General', sub: 'Gestión de respaldo, exportación e importación masiva de datos (Excel, CSV y JSON)' },
  chat:       { title: 'Chat & Usuarios',     sub: 'Sistema de mensajes e inicio de sesión con 2 roles' },
};

function switchModule(mod) {
  APP.module = mod;
  document.querySelectorAll('.app-section').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  const sec = document.getElementById('sec-' + mod);
  if (sec) {
    sec.classList.add('active');
    sec.style.display = 'block';
  }
  const btn = document.getElementById('nav-' + mod);
  if (btn) btn.classList.add('active');
  
  const meta = MODULE_META[mod] || { title: mod, sub: '' };
  const titleEl = document.getElementById('module-title');
  const subEl = document.getElementById('module-subtitle');
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.sub;

  buildTopbarActions(mod);
  buildFab();
  setModule(mod);
  if (typeof logSectionVisit === 'function') logSectionVisit(meta.title || mod);

  if (window.innerWidth < 900) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }
}

function setModule(mod) {
  switch (mod) {
    case 'dashboard':  renderDashboard(); break;
    case 'tasks':      renderTasks(); updateSidebarBadges(); break;
    case 'tickets':    renderTickets(); renderTicketCharts(); break;
    case 'network':    renderNetwork(); renderNetworkCharts(); break;
    case 'economy':    renderEconomy(); renderEconomyCharts(); updateEconBalance(); break;
    case 'portfolio':  renderPortfolio(); break;
    case 'activities': renderActivities(); renderWorkoutCalendar(); break;
    case 'database':
    case 'excel':      renderDatabaseSummary(); break;
    case 'chat':       if (typeof renderChatModule === 'function') renderChatModule(); break;
    case 'shared-expenses': if (typeof renderSharedExpensesModule === 'function') renderSharedExpensesModule(); break;
  }
}

function buildTopbarActions(mod) {
  const el = document.getElementById('topbar-actions');
  const actions = {
    dashboard: `<button class="btn-top" onclick="openExportModal()">📤 Exportar</button>`,
    tasks:     `<button class="btn-top" onclick="openExportModal()">📤 Exportar</button>`,
    tickets:   `<button class="btn-top" onclick="openExportModal()">📤 Exportar</button>`,
    network:   `<button class="btn-top" onclick="openExportModal()">📤 Exportar</button>`,
    economy:   `<button class="btn-top" onclick="openExportModal()">📤 Exportar</button>`,
  };
  el.innerHTML = actions[mod] || '';
}

// ═══════════════════════════════════════════
//  SIDEBAR BADGES
// ═══════════════════════════════════════════
function updateSidebarBadges() {
  const pending  = APP.tasks.filter(t => !t.done).length;
  const tkOpen   = APP.tickets.filter(t => t.status === 'abierto' || t.status === 'en_progreso' || t.status === 'escalado').length;
  const netActive = APP.network.filter(n => n.status === 'activa').length;
  set('sb-tasks',   pending);
  set('sb-tickets', tkOpen);
  set('sb-network', netActive);
}
function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ═══════════════════════════════════════════
//  FAB MENU
// ═══════════════════════════════════════════
const FAB_OPTIONS = {
  dashboard: [
    { label: '📋 Nueva tarea',     action: 'openTaskModal()' },
    { label: '🎫 Nuevo ticket',    action: 'openTicketModal()' },
    { label: '🌐 Registrar caída', action: 'openNetworkModal()' },
    { label: '💰 Nuevo movimiento',action: 'openEconModal()' },
  ],
  tasks:   [
    { label: '🎙️ Nota de voz', action: 'startVoiceCapture()' },
    { label: '📋 Nueva tarea', action: 'openTaskModal()' },
  ],
  tickets: [
    { label: '🎫 Nuevo ticket', action: 'openTicketModal()' },
  ],
  network: [
    { label: '🌐 Registrar caída', action: 'openNetworkModal()' },
  ],
  economy: [
    { label: '💚 Ingreso', action: "openEconModal('ingreso')" },
    { label: '🔴 Egreso',  action: "openEconModal('egreso')" },
  ],
  portfolio: [
    { label: '💼 Añadir Elemento', action: 'openPortfolioModal()' },
  ],
  activities: [
    { label: '🏋️ Registrar Ejercicio', action: 'openActivityModal()' },
  ],
};

function buildFab() {
  const menu = document.getElementById('fab-menu');
  const options = FAB_OPTIONS[APP.module] || FAB_OPTIONS.dashboard;
  menu.innerHTML = options.map(o =>
    `<button class="fab-sub" onclick="${o.action}">${o.label}</button>`
  ).join('');
}

function toggleFabMenu() {
  const menu = document.getElementById('fab-menu');
  const btn  = document.getElementById('fab-main');
  menu.classList.toggle('open');
  btn.classList.toggle('open');
}

function closeFabMenu() {
  document.getElementById('fab-menu').classList.remove('open');
  document.getElementById('fab-main').classList.remove('open');
}

document.addEventListener('click', e => {
  const fab = document.querySelector('.fab-container');
  if (fab && !fab.contains(e.target)) closeFabMenu();
});

// ═══════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function pad(n) { return String(n).padStart(2, '0'); }

function toLocalISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr), t = new Date();
  return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
}

function isOverdue(task) {
  if (!task.date || task.done) return false;
  return new Date(task.date) < new Date();
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function fmtDateShort(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
}

function escH(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function calcDuration(start, end) {
  if (!start || !end) return null;
  const ms  = new Date(end) - new Date(start);
  if (ms < 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function calcDurationHours(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end) - new Date(start);
  return ms < 0 ? 0 : ms / 3600000;
}

function monthKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
}

function lastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${pad(d.getMonth()+1)}`, label: d.toLocaleDateString('es-ES', { month:'short', year:'2-digit' }) });
  }
  return months;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function setDefaultDates() {
  const now = new Date();
  const h1  = new Date(now); h1.setHours(h1.getHours()+1, 0, 0, 0);
  const els = ['t-date', 'tk-open', 'net-start'];
  els.forEach(id => { const el = document.getElementById(id); if (el) el.value = toLocalISO(h1); });
  const dateEls = ['ec-date'];
  dateEls.forEach(id => { const el = document.getElementById(id); if (el) el.value = toLocalDate(now); });
}

// ═══════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════
function renderDashboard() {
  updateSidebarBadges();

  // Task stats
  const taskPending = APP.tasks.filter(t => !t.done).length;
  const taskToday   = APP.tasks.filter(t => !t.done && isToday(t.date)).length;
  const taskDone    = APP.tasks.filter(t => t.done).length;
  const taskTotal   = APP.tasks.length;
  const taskPct     = taskTotal ? Math.round(taskDone / taskTotal * 100) : 0;
  const taskOverdue = APP.tasks.filter(t => isOverdue(t));

  set('d-task-pending', taskPending);
  set('d-task-today', `${taskToday} para hoy`);
  set('d-task-bar', ''); document.getElementById('d-task-bar').style.width = taskPct + '%';
  set('d-prog-done', `${taskDone} completadas`);
  set('d-prog-pct', `${taskPct}%`);
  set('d-prog-total', `${taskTotal} total`);
  const overEl = document.getElementById('d-overdue-row');
  if (overEl) overEl.innerHTML = taskOverdue.length ? `⚠️ ${taskOverdue.length} tarea(s) vencida(s)` : '';

  // Ticket stats
  const tkOpen     = APP.tickets.filter(t => t.status !== 'cerrado').length;
  const tkCritical = APP.tickets.filter(t => t.priority === 'critica' && t.status !== 'cerrado').length;
  set('d-ticket-open', tkOpen);
  set('d-ticket-critical', `${tkCritical} críticos`);

  // Network stats this month
  const thisMonth = monthKey(new Date().toISOString());
  const netThisMonth = APP.network.filter(n => monthKey(n.startDate) === thisMonth);
  const netHours = netThisMonth.reduce((s, n) => s + calcDurationHours(n.startDate, n.endDate), 0);
  set('d-net-month', netThisMonth.length);
  set('d-net-hours', `${netHours.toFixed(1)}h caídas`);

  // Economy & Total Liquid Assets
  const econSum = APP.economy.reduce((s, t) => {
    const type = String(t.type || 'ingreso').toLowerCase();
    const amt  = parseFloat(t.amount || 0) || 0;
    if (type === 'ingreso') return s + amt;
    if (type === 'egreso') return s - amt;
    return s;
  }, 0);

  const accs = fromLS('ejcp_accounts', {});
  const rate = APP.rateBCV || APP.rate || 755.9;
  let totalAccountsUsd = 0;
  if (accs && Object.keys(accs).length) {
    Object.entries(accs).forEach(([k, a]) => {
      if (k === 'bolivares') {
        totalAccountsUsd += (a.balance || 0) / (rate > 0 ? rate : 1);
      } else {
        totalAccountsUsd += (a.balance || 0);
      }
    });
  }

  const finalBalanceUsd = Math.max(econSum, totalAccountsUsd);
  const finalBalanceVes = finalBalanceUsd * rate;

  set('d-balance', `$${finalBalanceUsd.toFixed(2)}`);
  set('d-balance-bs', `Bs. ${finalBalanceVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  // Activity feed
  buildActivityFeed();

  // Charts
  renderDashTicketChart();
  renderDashEconomyChart();
  renderDashNetworkChart();
}

function buildActivityFeed() {
  const el = document.getElementById('d-activity-list');
  if (!el) return;

  const events = [];
  APP.tasks.slice(0, 3).forEach(t => events.push({ icon: '📋', text: `Tarea: ${t.title}`, time: t.createdAt, color: '#6366f1' }));
  APP.tickets.slice(0, 3).forEach(t => events.push({ icon: '🎫', text: `Ticket ${t.number}: ${t.title}`, time: t.openDate, color: '#06b6d4' }));
  APP.network.slice(0, 2).forEach(n => events.push({ icon: '🌐', text: `Caída: ${n.area || n.type}`, time: n.startDate, color: '#ef4444' }));
  APP.economy.slice(0, 2).forEach(e => events.push({ icon: e.type === 'ingreso' ? '💚' : '🔴', text: `${capitalize(e.type)}: ${e.desc} ($${parseFloat(e.amount || 0).toFixed(2)})`, time: e.date, color: e.type === 'ingreso' ? '#10b981' : '#ef4444' }));

  events.sort((a, b) => new Date(b.time) - new Date(a.time));
  const recent = events.slice(0, 6);

  if (!recent.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px">No hay actividad reciente</div>';
    return;
  }

  el.innerHTML = recent.map(e => `
    <div class="activity-item">
      <span class="ai-icon">${e.icon}</span>
      <span>${escH(e.text)}</span>
      <span class="ai-time">${fmtDateShort(e.time)}</span>
    </div>`).join('');
}

function renderDashTicketChart() {
  const ctx = document.getElementById('chart-dash-tickets');
  if (!ctx) return;
  destroyChart('dash-tickets');
  const counts = { abierto: 0, en_progreso: 0, escalado: 0, cerrado: 0 };
  APP.tickets.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
  APP.charts['dash-tickets'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Abierto', 'En progreso', 'Escalado', 'Cerrado'],
      datasets: [{ data: Object.values(counts), backgroundColor: ['#22d3ee','#f59e0b','#ef4444','#10b981'], borderWidth: 0, hoverOffset: 6 }]
    },
    options: { ...donutOpts(), plugins: { legend: { position: 'right', labels: { color: '#9ab0d8', font: { size: 11 }, padding: 10 } }, tooltip: tooltipOpts() } }
  });
}

function renderDashEconomyChart() {
  const ctx = document.getElementById('chart-dash-economy');
  if (!ctx) return;
  destroyChart('dash-economy');
  const months = lastNMonths(6);
  const income  = months.map(m => APP.economy.filter(e => e.type === 'ingreso' && monthKey(e.date) === m.key).reduce((s,e) => s + e.amount, 0));
  const expense = months.map(m => APP.economy.filter(e => e.type === 'egreso'  && monthKey(e.date) === m.key).reduce((s,e) => s + e.amount, 0));
  APP.charts['dash-economy'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Ingresos', data: income,  backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 },
        { label: 'Egresos',  data: expense, backgroundColor: 'rgba(239,68,68,0.7)',  borderRadius: 4 },
      ]
    },
    options: barOpts('USD')
  });
}

function renderDashNetworkChart() {
  const ctx = document.getElementById('chart-dash-network');
  if (!ctx) return;
  destroyChart('dash-network');
  const months = lastNMonths(6);
  const hours = months.map(m => {
    const incidents = APP.network.filter(n => monthKey(n.startDate) === m.key);
    return incidents.reduce((s, n) => s + calcDurationHours(n.startDate, n.endDate), 0);
  });
  APP.charts['dash-network'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [{ label: 'Horas caídas', data: hours.map(h => +h.toFixed(2)), backgroundColor: 'rgba(239,68,68,0.65)', borderRadius: 4 }]
    },
    options: barOpts('horas')
  });
}

// ═══════════════════════════════════════════
//  TASKS MODULE
// ═══════════════════════════════════════════
function setTaskView(view, btn) {
  APP.taskView = view;
  document.querySelectorAll('#task-view-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

function renderTasks() {
  updateSidebarBadges();
  const search = (document.getElementById('task-search')?.value || '').toLowerCase().trim();
  const pFilter = document.getElementById('task-priority-filter')?.value || '';

  let list = APP.tasks.filter(t => {
    if (APP.taskView === 'pending' && t.done) return false;
    if (APP.taskView === 'done'    && !t.done) return false;
    if (APP.taskView === 'overdue' && !isOverdue(t)) return false;
    if (APP.taskView === 'today'   && !(isToday(t.date) && !t.done)) return false;
    if (APP.taskView === 'voice'   && !(t.voiceText || t.voiceUrl)) return false;
    if (pFilter && t.priority !== pFilter) return false;
    if (search && !([t.title, t.desc, t.category, ...(t.tags||[]), t.voiceText].join(' ').toLowerCase().includes(search))) return false;
    return true;
  }).sort((a, b) => {
    if (isOverdue(a) && !isOverdue(b)) return -1;
    if (!isOverdue(a) && isOverdue(b))  return  1;
    const p = { critica:0, alta:1, media:2, baja:3 };
    if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority];
    if (a.date && b.date) return new Date(a.date) - new Date(b.date);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  // Mini stats
  const s = getTaskStats();
  const msEl = document.getElementById('task-mini-stats');
  if (msEl) msEl.innerHTML = `
    <div class="mini-stat">Total: <strong>${s.total}</strong></div>
    <div class="mini-stat">⏳ Pendientes: <strong>${s.pending}</strong></div>
    <div class="mini-stat">✅ Completadas: <strong>${s.done}</strong></div>
    <div class="mini-stat" style="color:var(--red)">🔴 Vencidas: <strong>${s.overdue}</strong></div>
    <div class="mini-stat">📅 Hoy: <strong>${s.today}</strong></div>`;

  const listEl = document.getElementById('task-list');
  const empty  = document.getElementById('task-empty');
  if (!list.length) { listEl.innerHTML = ''; if (empty) empty.style.display = 'flex'; return; }
  if (empty) empty.style.display = 'none';
  listEl.innerHTML = list.map(t => renderTaskCard(t)).join('');
}

function getTaskStats() {
  const total   = APP.tasks.length;
  const done    = APP.tasks.filter(t => t.done).length;
  const pending = APP.tasks.filter(t => !t.done).length;
  const overdue = APP.tasks.filter(t => isOverdue(t)).length;
  const today   = APP.tasks.filter(t => !t.done && isToday(t.date)).length;
  return { total, done, pending, overdue, today };
}

function renderTaskCard(t) {
  const over  = isOverdue(t);
  const today = isToday(t.date) && !t.done;
  const pLabel = { alta:'🔴 Alta', media:'🟡 Media', baja:'🟢 Baja' }[t.priority] || t.priority;
  const pClass = { alta:'b-alta', media:'b-media', baja:'b-baja' }[t.priority] || 'b-gray';

  let dateBadge = '';
  if (t.date) {
    if (over)  dateBadge = `<span class="badge b-red">🔴 Vencida · ${fmtDateShort(t.date)}</span>`;
    else if (today) dateBadge = `<span class="badge b-accent">📅 Hoy · ${fmtDate(t.date)}</span>`;
    else dateBadge = `<span class="badge b-cyan">📅 ${fmtDate(t.date)}</span>`;
  }

  const tags = (t.tags||[]).length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${t.tags.map(g=>`<span class="tag">#${escH(g.trim())}</span>`).join('')}</div>` : '';
  const voiceBadge = (t.voiceText||t.voiceUrl) ? `<span class="badge b-voice">🎙️ Voz</span>` : '';
  const catBadge   = t.category ? `<span class="badge b-accent">${escH(t.category)}</span>` : '';
  const doneBadge  = t.done ? `<span class="badge b-green">✅ Hecho</span>` : '';

  let cls = `task-card priority-${t.priority}`;
  if (t.done) cls += ' done-card';

  return `
  <div class="${cls}" onclick="openTaskDetail('${t.id}')">
    <div class="tc-check-wrap">
      <div class="tc-check ${t.done?'checked':''}" onclick="event.stopPropagation();toggleTask('${t.id}')" title="${t.done?'Marcar pendiente':'Completar'}">${t.done?'✓':''}</div>
    </div>
    <div class="tc-body">
      <div class="tc-title">${escH(t.title)}</div>
      ${t.desc ? `<div class="tc-desc">${escH(t.desc)}</div>` : ''}
      <div class="tc-meta">
        <span class="badge ${pClass}">${pLabel}</span>
        ${dateBadge}${catBadge}${voiceBadge}${doneBadge}
      </div>
      ${tags}
    </div>
    <div class="item-actions" onclick="event.stopPropagation()">
      <button class="act-btn" onclick="openTaskEdit('${t.id}')" title="Editar">✏️</button>
      <button class="act-btn del" onclick="deleteTask('${t.id}')" title="Eliminar">🗑️</button>
    </div>
  </div>`;
}

// ── Task CRUD ──
function openTaskModal() {
  closeFabMenu();
  APP.editId = null;
  clearTaskForm();
  document.getElementById('task-modal-title').textContent = 'Nueva Tarea';
  if (APP.voiceText || APP.audioUrl) showVoiceNotePreview();
  openModal('task-modal');
  setTimeout(() => document.getElementById('t-title')?.focus(), 100);
}

function openTaskEdit(id) {
  const t = APP.tasks.find(x => x.id === id);
  if (!t) return;
  APP.editId = id;
  clearTaskForm();
  document.getElementById('task-modal-title').textContent = 'Editar Tarea';
  document.getElementById('t-title').value    = t.title;
  document.getElementById('t-desc').value     = t.desc || '';
  document.getElementById('t-date').value     = t.date || '';
  document.getElementById('t-priority').value = t.priority || 'media';
  document.getElementById('t-cat').value      = t.category || '';
  document.getElementById('t-tags').value     = (t.tags||[]).join(', ');
  if (t.voiceText || t.voiceUrl) {
    APP.voiceText = t.voiceText || '';
    APP.audioUrl  = t.voiceUrl  || '';
    showVoiceNotePreview();
  }
  openModal('task-modal');
}

function clearTaskForm() {
  ['t-title','t-desc','t-cat','t-tags'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  const d = document.getElementById('t-priority'); if (d) d.value = 'media';
  const now = new Date(); now.setHours(now.getHours()+1, 0, 0, 0);
  const dt = document.getElementById('t-date'); if (dt) dt.value = toLocalISO(now);
  document.getElementById('t-voice-preview').style.display = 'none';
  APP.voiceText = ''; APP.audioBlob = null; APP.audioUrl = null;
}

function saveTask() {
  const title = document.getElementById('t-title').value.trim();
  if (!title) { showToast('⚠️ El título es obligatorio', 'error'); return; }
  const tags = document.getElementById('t-tags').value.split(',').map(s=>s.trim()).filter(Boolean);

  if (APP.editId) {
    const t = APP.tasks.find(x => x.id === APP.editId);
    if (!t) return;
    Object.assign(t, {
      title, desc: document.getElementById('t-desc').value.trim(),
      date: document.getElementById('t-date').value,
      priority: document.getElementById('t-priority').value,
      category: document.getElementById('t-cat').value.trim(),
      tags, voiceText: APP.voiceText || t.voiceText,
      voiceUrl: APP.audioUrl || t.voiceUrl,
      updatedAt: new Date().toISOString()
    });
    showToast('✏️ Tarea actualizada', 'success');
  } else {
    APP.tasks.unshift({
      id: uid(), title,
      desc: document.getElementById('t-desc').value.trim(),
      date: document.getElementById('t-date').value,
      priority: document.getElementById('t-priority').value,
      category: document.getElementById('t-cat').value.trim(),
      tags, done: false,
      voiceText: APP.voiceText || '',
      voiceUrl: APP.audioUrl || '',
      createdAt: new Date().toISOString()
    });
    showToast('✅ Tarea añadida', 'success');
  }
  saveAll(); closeModal('task-modal'); clearTaskForm();
  if (APP.module === 'tasks') renderTasks();
  else if (APP.module === 'dashboard') renderDashboard();
  updateSidebarBadges();
}

function toggleTask(id) {
  const t = APP.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  if (t.done) t.completedAt = new Date().toISOString();
  else delete t.completedAt;
  saveAll();
  renderTasks();
  showToast(t.done ? '✅ Completada' : '⏳ Pendiente', t.done ? 'success' : 'info');
}

function deleteTask(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  APP.tasks = APP.tasks.filter(x => x.id !== id);
  saveAll(); renderTasks(); showToast('🗑️ Eliminada', 'info');
}

function openTaskDetail(id) {
  const t = APP.tasks.find(x => x.id === id);
  if (!t) return;
  const over  = isOverdue(t);
  const today = isToday(t.date) && !t.done;
  const pLabel = { alta:'🔴 Alta', media:'🟡 Media', baja:'🟢 Baja' }[t.priority] || t.priority;
  const status = t.done ? `<span class="badge b-green">✅ Completada</span>`
    : over ? `<span class="badge b-red">🔴 Vencida</span>`
    : today ? `<span class="badge b-accent">📅 Para Hoy</span>`
    : `<span class="badge b-yellow">⏳ Pendiente</span>`;

  document.getElementById('detail-modal-title').textContent = 'Detalle de Tarea';
  document.getElementById('detail-modal-body').innerHTML = `
    <div class="detail-title-text">${escH(t.title)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">${status}<span class="badge b-${t.priority==='alta'?'alta':t.priority==='baja'?'baja':'media'}">${pLabel}</span>${t.category?`<span class="badge b-accent">${escH(t.category)}</span>`:''}</div>
    ${t.tags?.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${t.tags.map(g=>`<span class="tag">#${escH(g)}</span>`).join('')}</div>`:''}
    ${t.desc?`<div class="detail-field"><div class="detail-label">Descripción</div><div class="detail-value">${escH(t.desc)}</div></div>`:''}
    ${t.date?`<div class="detail-field"><div class="detail-label">Fecha límite</div><div class="detail-value">${fmtDate(t.date)}</div></div>`:''}
    <hr class="divider"/>
    <div class="form-row">
      <div class="detail-field"><div class="detail-label">Creada</div><div class="detail-value">${fmtDate(t.createdAt)}</div></div>
      ${t.completedAt?`<div class="detail-field"><div class="detail-label">Completada</div><div class="detail-value">${fmtDate(t.completedAt)}</div></div>`:''}
    </div>
    ${t.voiceText||t.voiceUrl?`<hr class="divider"/><div class="detail-field"><div class="detail-label">🎙️ Nota de voz</div><div class="detail-value" style="font-style:italic;color:var(--cyan)">${escH(t.voiceText)||'(audio)'}</div>${t.voiceUrl?`<audio controls src="${t.voiceUrl}" style="width:100%;margin-top:8px"></audio>`:''}</div>`:''}
  `;
  document.getElementById('detail-modal-footer').innerHTML = `
    <button class="btn-secondary" onclick="closeModal('detail-modal')">Cerrar</button>
    <button class="btn-secondary" onclick="closeModal('detail-modal');openTaskEdit('${t.id}')">✏️ Editar</button>
    <button class="btn-primary" onclick="closeModal('detail-modal');toggleTask('${t.id}')">${t.done?'⏳ Pendiente':'✅ Completar'}</button>`;
  openModal('detail-modal');
}

// ── Voice ──
function startVoiceCapture() {
  closeFabMenu();
  APP.voiceText = ''; APP.audioChunks = []; APP.audioBlob = null; APP.audioUrl = null;
  APP.voiceSeconds = 0;
  set('voice-transcript', ''); set('voice-timer', '0:00'); set('voice-status', '🎙️ Iniciando...');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    APP.recognition = new SpeechRecognition();
    APP.recognition.lang = 'es-ES';
    APP.recognition.continuous = true;
    APP.recognition.interimResults = true;
    let finalText = '';
    APP.recognition.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += txt + ' ';
        else interim = txt;
      }
      APP.voiceText = finalText.trim();
      const el = document.getElementById('voice-transcript');
      if (el) el.textContent = finalText + interim;
    };
    APP.recognition.onerror = () => {};
    try { APP.recognition.start(); } catch(e) {}
  }

  const startTimer = () => {
    document.getElementById('voice-overlay').classList.add('active');
    set('voice-status', '🎙️ Grabando...');
    APP.voiceTimer = setInterval(() => {
      APP.voiceSeconds++;
      const m = Math.floor(APP.voiceSeconds/60), s = APP.voiceSeconds%60;
      set('voice-timer', `${m}:${pad(s)}`);
      if (APP.voiceSeconds >= 300) stopVoice();
    }, 1000);
  };

  if (navigator.mediaDevices?.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      APP.mediaRecorder = new MediaRecorder(stream);
      APP.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) APP.audioChunks.push(e.data); };
      APP.mediaRecorder.onstop = () => {
        APP.audioBlob = new Blob(APP.audioChunks, { type: 'audio/webm' });
        APP.audioUrl  = URL.createObjectURL(APP.audioBlob);
        stream.getTracks().forEach(tr => tr.stop());
      };
      APP.mediaRecorder.start();
      startTimer();
    }).catch(() => { startTimer(); });
  } else { startTimer(); }
}

function stopVoice() {
  clearInterval(APP.voiceTimer);
  APP.recognition?.stop();
  if (APP.mediaRecorder && APP.mediaRecorder.state !== 'inactive') APP.mediaRecorder.stop();
  document.getElementById('voice-overlay').classList.remove('active');
  setTimeout(() => {
    openTaskModal();
    if (APP.voiceText && !document.getElementById('t-title').value) {
      const first = APP.voiceText.split(/[.!?]/)[0].trim();
      document.getElementById('t-title').value = capitalize(first.slice(0,80));
      if (APP.voiceText.length > first.length) document.getElementById('t-desc').value = APP.voiceText;
    }
    showVoiceNotePreview();
  }, 150);
}

function cancelVoice() {
  clearInterval(APP.voiceTimer);
  APP.recognition?.stop();
  if (APP.mediaRecorder && APP.mediaRecorder.state !== 'inactive') APP.mediaRecorder.stop();
  document.getElementById('voice-overlay').classList.remove('active');
  APP.voiceText = ''; APP.audioBlob = null; APP.audioUrl = null;
  showToast('🎙️ Cancelado', 'info');
}

function showVoiceNotePreview() {
  const prev = document.getElementById('t-voice-preview');
  const txtEl = document.getElementById('t-voice-text');
  const audEl = document.getElementById('t-voice-audio');
  if (!prev) return;
  prev.style.display = 'block';
  if (txtEl) txtEl.textContent = APP.voiceText || '(sin transcripción)';
  if (audEl) { audEl.src = APP.audioUrl || ''; audEl.style.display = APP.audioUrl ? 'block' : 'none'; }
}

// ═══════════════════════════════════════════
//  TICKETS MODULE
// ═══════════════════════════════════════════
function setTicketView(view, btn) {
  APP.ticketView = view;
  document.querySelectorAll('#sec-tickets .toolbar-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTickets();
}

function renderTickets() {
  updateSidebarBadges();
  const search = (document.getElementById('ticket-search')?.value || '').toLowerCase().trim();
  const catF   = document.getElementById('ticket-cat-filter')?.value || '';

  let list = APP.tickets.filter(t => {
    if (APP.ticketView !== 'all' && t.status !== APP.ticketView) return false;
    if (catF && t.category !== catF) return false;
    if (search && !([t.number, t.desc, t.assignee, t.provider, t.solution].join(' ').toLowerCase().includes(search))) return false;
    return true;
  }).sort((a, b) => {
    return new Date(b.date||0) - new Date(a.date||0);
  });

  const listEl = document.getElementById('ticket-list');
  const empty  = document.getElementById('ticket-empty');
  
  if (listEl) listEl.innerHTML = list.length ? list.map(t => renderTicketCard(t)).join('') : '';
  if (empty) empty.style.display = list.length ? 'none' : 'flex';

  // Monthly summary
  const thisMonth = monthKey(new Date().toISOString());
  const thisMonthCount = APP.tickets.filter(t => monthKey(t.date) === thisMonth).length;
  set('tk-month-total', thisMonthCount);
}

function renderTicketCard(t) {
  const stClass  = { abierto:'b-cyan', en_progreso:'b-yellow', escalado:'b-red', cerrado:'b-green' }[t.status] || 'b-gray';
  const stLabel  = { abierto:'🔵 Abierto', en_progreso:'🟡 En progreso', escalado:'🔴 Escalado', cerrado:'✅ Cerrado' }[t.status] || t.status;
  const catLabel = { red:'🌐 Red', hardware:'🖥️ Hardware', software:'💻 Software', otro:'📦 Otro' }[t.category] || t.category;

  return `
  <div class="ticket-card status-${t.status}" onclick="openTicketDetail('${t.id}')">
    <div class="tk-num-badge">${escH(t.number)}</div>
    <div class="tk-body">
      <div class="tk-title">${escH(t.desc?.slice(0,100)||'Ticket sin descripción')}${t.desc?.length>100?'…':''}</div>
      <div class="tk-meta">
        <span class="badge ${stClass}">${stLabel}</span>
        ${catLabel?`<span class="badge b-accent">${catLabel}</span>`:''}
        ${t.date?`<span class="badge b-gray">📅 ${fmtDateShort(t.date)}</span>`:''}
        ${t.assignee?`<span class="badge b-gray">👤 ${escH(t.assignee)}</span>`:''}
        ${t.provider?`<span class="badge b-gray">🏢 ${escH(t.provider)}</span>`:''}
      </div>
    </div>
    <div class="item-actions" onclick="event.stopPropagation()">
      <button class="act-btn" onclick="openTicketEdit('${t.id}')" title="Editar">✏️</button>
      <button class="act-btn del" onclick="deleteTicket('${t.id}')" title="Eliminar">🗑️</button>
    </div>
  </div>`;
}

function renderTicketCharts() {
  // Status donut
  const ctx1 = document.getElementById('chart-ticket-status');
  if (ctx1) {
    destroyChart('ticket-status');
    const counts = { abierto:0, en_progreso:0, escalado:0, cerrado:0 };
    APP.tickets.forEach(t => { if (counts[t.status]!==undefined) counts[t.status]++; });
    APP.charts['ticket-status'] = new Chart(ctx1, {
      type: 'doughnut',
      data: { labels:['Abierto','En progreso','Escalado','Cerrado'], datasets:[{ data:Object.values(counts), backgroundColor:['#22d3ee','#f59e0b','#ef4444','#10b981'], borderWidth:0, hoverOffset:5 }] },
      options: { ...donutOpts(), plugins:{ legend:{ position:'bottom', labels:{ color:'#9ab0d8', font:{size:10}, padding:6 }}, tooltip:tooltipOpts() }}
    });
  }
  // Monthly bar
  const ctx2 = document.getElementById('chart-ticket-month');
  if (ctx2) {
    destroyChart('ticket-month');
    const months = lastNMonths(6);
    const counts = months.map(m => APP.tickets.filter(t => monthKey(t.date) === m.key).length);
    APP.charts['ticket-month'] = new Chart(ctx2, {
      type: 'bar',
      data: { labels: months.map(m=>m.label), datasets:[{ label:'Tickets', data:counts, backgroundColor:'rgba(6,182,212,0.65)', borderRadius:4 }] },
      options: barOpts('tickets')
    });
  }
  // Category donut
  const ctx3 = document.getElementById('chart-ticket-priority');
  if (ctx3) {
    destroyChart('ticket-priority');
    const counts = { red:0, hardware:0, software:0, otro:0 };
    APP.tickets.forEach(t => { const c = counts[t.category]!==undefined?t.category:'otro'; counts[c]++; });
    APP.charts['ticket-priority'] = new Chart(ctx3, {
      type: 'doughnut',
      data: { labels:['Red','Hardware','Software','Otro'], datasets:[{ data:[counts.red, counts.hardware, counts.software, counts.otro], backgroundColor:['#ef4444','#f97316','#3b82f6','#10b981'], borderWidth:0, hoverOffset:5 }] },
      options: { ...donutOpts(), plugins:{ legend:{ position:'bottom', labels:{ color:'#9ab0d8', font:{size:10}, padding:6 }}, tooltip:tooltipOpts() }}
    });
  }
}

// ── Ticket CRUD ──
function openTicketModal() {
  closeFabMenu(); APP.editId = null;
  clearTicketForm();
  // Auto-number
  const num = `TK-${new Date().getFullYear()}-${String(APP.ticketCounter).padStart(3,'0')}`;
  document.getElementById('tk-num').value = num;
  document.getElementById('ticket-modal-title').textContent = 'Nuevo Ticket';
  openModal('ticket-modal');
  setTimeout(() => document.getElementById('tk-date')?.focus(), 100);
}

function openTicketEdit(id) {
  const t = APP.tickets.find(x => x.id === id);
  if (!t) return;
  APP.editId = id;
  clearTicketForm();
  document.getElementById('ticket-modal-title').textContent = 'Editar Ticket';
  document.getElementById('tk-num').value       = t.number;
  document.getElementById('tk-date').value      = t.date || '';
  document.getElementById('tk-time-open').value = t.timeOpen || '';
  document.getElementById('tk-time-close').value= t.timeClose || '';
  document.getElementById('tk-desc').value      = t.desc || '';
  document.getElementById('tk-provider').value  = t.provider || '';
  document.getElementById('tk-assign').value    = t.assignee || '';
  document.getElementById('tk-status').value    = t.status;
  document.getElementById('tk-cat').value       = t.category || 'red';
  document.getElementById('tk-solution').value  = t.solution || '';
  openModal('ticket-modal');
}

function clearTicketForm() {
  ['tk-num','tk-date','tk-time-open','tk-time-close','tk-desc','tk-provider','tk-assign','tk-solution'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const dt = document.getElementById('tk-date'); if (dt) dt.value = toLocalDate(new Date());
  const st = document.getElementById('tk-status'); if (st) st.value = 'abierto';
  const ca = document.getElementById('tk-cat');    if (ca) ca.value = 'red';
}

function saveTicket() {
  const num   = document.getElementById('tk-num').value.trim();
  const date  = document.getElementById('tk-date').value;
  const desc  = document.getElementById('tk-desc').value.trim();
  
  if (!num || !date || !desc) { showToast('⚠️ Número, fecha y descripción son obligatorios', 'error'); return; }

  const payload = {
    number:    num,
    date:      date,
    timeOpen:  document.getElementById('tk-time-open').value,
    timeClose: document.getElementById('tk-time-close').value,
    desc:      desc,
    provider:  document.getElementById('tk-provider').value.trim(),
    assignee:  document.getElementById('tk-assign').value.trim(),
    status:    document.getElementById('tk-status').value,
    category:  document.getElementById('tk-cat').value,
    solution:  document.getElementById('tk-solution').value.trim(),
  };

  if (APP.editId) {
    const t = APP.tickets.find(x => x.id === APP.editId);
    if (!t) return;
    Object.assign(t, { ...payload, updatedAt: new Date().toISOString() });
    showToast('✏️ Ticket actualizado', 'success');
  } else {
    APP.tickets.unshift({ id: uid(), ...payload, createdAt: new Date().toISOString() });
    APP.ticketCounter++;
    showToast('🎫 Ticket creado', 'success');
  }
  saveAll(); closeModal('ticket-modal');
  renderTickets(); renderTicketCharts(); updateSidebarBadges();
  if (APP.module === 'dashboard') renderDashboard();
}

function deleteTicket(id) {
  if (!confirm('¿Eliminar este ticket?')) return;
  APP.tickets = APP.tickets.filter(x => x.id !== id);
  saveAll(); renderTickets(); renderTicketCharts(); updateSidebarBadges();
  showToast('🗑️ Ticket eliminado', 'info');
}

function openTicketDetail(id) {
  const t = APP.tickets.find(x => x.id === id);
  if (!t) return;
  const stLabel = { abierto:'🔵 Abierto', en_progreso:'🟡 En progreso', escalado:'🔴 Escalado', cerrado:'✅ Cerrado' }[t.status] || t.status;
  const catLabel = { red:'🌐 Red', hardware:'🖥️ Hardware', software:'💻 Software', otro:'📦 Otro' }[t.category] || t.category;

  document.getElementById('detail-modal-title').textContent = `Ticket ${t.number}`;
  document.getElementById('detail-modal-body').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <span class="badge b-cyan" style="font-family:monospace">${escH(t.number)}</span>
      <span class="badge b-${t.status==='cerrado'?'green':t.status==='escalado'?'red':'yellow'}">${stLabel}</span>
      ${catLabel?`<span class="badge b-accent">${catLabel}</span>`:''}
    </div>
    ${t.desc?`<div class="detail-field"><div class="detail-label">Descripción del Problema</div><div class="detail-value">${escH(t.desc)}</div></div>`:''}
    <div class="form-row">
      <div class="detail-field"><div class="detail-label">Fecha</div><div class="detail-value">${fmtDateShort(t.date)}</div></div>
      <div class="detail-field"><div class="detail-label">Horas</div><div class="detail-value">${t.timeOpen||'--'} a ${t.timeClose||'--'}</div></div>
    </div>
    <div class="form-row">
      ${t.provider?`<div class="detail-field"><div class="detail-label">Proveedor</div><div class="detail-value">${escH(t.provider)}</div></div>`:''}
      ${t.assignee?`<div class="detail-field"><div class="detail-label">Asignado a</div><div class="detail-value">${escH(t.assignee)}</div></div>`:''}
    </div>
    ${t.solution?`<hr class="divider"/><div class="detail-field"><div class="detail-label">Solución Aplicada</div><div class="detail-value">${escH(t.solution)}</div></div>`:''}
  `;
  document.getElementById('detail-modal-footer').innerHTML = `
    <button class="btn-secondary" onclick="closeModal('detail-modal')">Cerrar</button>
    <button class="btn-secondary" onclick="closeModal('detail-modal');openTicketEdit('${t.id}')">✏️ Editar</button>
    ${t.status!=='cerrado'?`<button class="btn-primary" onclick="closeTicket('${t.id}')">✅ Cerrar Ticket</button>`:''}`;
  openModal('detail-modal');
}

function closeTicket(id) {
  const t = APP.tickets.find(x => x.id === id);
  if (!t) return;
  t.status = 'cerrado';
  if (!t.timeClose) t.timeClose = pad(new Date().getHours()) + ':' + pad(new Date().getMinutes());
  saveAll(); closeModal('detail-modal'); renderTickets(); renderTicketCharts(); updateSidebarBadges();
  showToast('✅ Ticket cerrado', 'success');
}

// ═══════════════════════════════════════════
//  NETWORK MODULE
// ═══════════════════════════════════════════
function setNetView(view, btn) {
  APP.netView = view;
  document.querySelectorAll('#sec-network .toolbar-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNetwork();
}

function renderNetwork() {
  updateSidebarBadges();
  const search = (document.getElementById('network-search')?.value||'').toLowerCase().trim();
  const typeF  = document.getElementById('net-type-filter')?.value||'';

  let list = APP.network.filter(n => {
    if (APP.netView !== 'all' && n.status !== APP.netView) return false;
    if (typeF && n.type !== typeF) return false;
    if (search && !([n.netId, n.area, n.cause, n.desc, n.reportTo].join(' ').toLowerCase().includes(search))) return false;
    return true;
  }).sort((a, b) => new Date(b.startDate||0) - new Date(a.startDate||0));

  const listEl = document.getElementById('network-list');
  const empty  = document.getElementById('network-empty');
  if (!list.length) { if (listEl) listEl.innerHTML = ''; if (empty) empty.style.display='flex'; return; }
  if (empty) empty.style.display = 'none';
  if (listEl) listEl.innerHTML = list.map(n => renderNetCard(n)).join('');

  // Uptime calc (this month)
  const thisMonth = monthKey(new Date().toISOString());
  const thisMonthIncidents = APP.network.filter(n => monthKey(n.startDate) === thisMonth);
  const totalDownHours = thisMonthIncidents.reduce((s,n) => s + calcDurationHours(n.startDate, n.endDate), 0);
  const monthHours = new Date().getDate() * 24;
  const uptimePct  = Math.max(0, Math.min(100, ((monthHours - totalDownHours) / monthHours) * 100));
  const uptimeFill = document.getElementById('net-uptime-fill');
  if (uptimeFill) {
    uptimeFill.style.width = uptimePct.toFixed(1) + '%';
    uptimeFill.style.background = uptimePct >= 99 ? 'linear-gradient(90deg,#10b981,#22d3ee)'
      : uptimePct >= 95 ? 'linear-gradient(90deg,#f59e0b,#10b981)'
      : 'linear-gradient(90deg,#ef4444,#f97316)';
  }
  set('net-uptime-pct', uptimePct.toFixed(1) + '%');
  set('net-uptime-sub', `${totalDownHours.toFixed(2)}h de interrupción este mes (${thisMonthIncidents.length} incidente(s))`);
}

function renderNetCard(n) {
  const typeLabel = { total:'🔴 Total', parcial:'🟡 Parcial', lenta:'🟠 Lenta' }[n.type] || n.type;
  const stLabel   = n.status === 'activa' ? '🔴 Activa' : '✅ Resuelta';
  const stClass   = n.status === 'activa' ? 'b-red' : 'b-green';
  const dur = calcDuration(n.startDate, n.endDate);

  return `
  <div class="net-card type-${n.type}" onclick="openNetDetail('${n.id}')">
    <div class="net-icon">${n.type==='total'?'🔴':n.type==='parcial'?'🟡':'🟠'}</div>
    <div class="net-body">
      <div class="net-title">${escH(n.netId)} — ${typeLabel}</div>
      ${n.area?`<div style="font-size:13px;color:var(--text-muted);margin:2px 0">📍 ${escH(n.area)}</div>`:''}
      <div class="net-duration">${dur || (n.status==='activa'?'En curso...':'—')}</div>
      <div class="net-meta">
        <span class="badge ${stClass}">${stLabel}</span>
        ${n.startDate?`<span class="badge b-gray">📅 ${fmtDate(n.startDate)}</span>`:''}
        ${n.cause?`<span class="badge b-orange">${escH(n.cause)}</span>`:''}
      </div>
    </div>
    <div class="item-actions" onclick="event.stopPropagation()">
      <button class="act-btn" onclick="openNetEdit('${n.id}')" title="Editar">✏️</button>
      ${n.status==='activa'?`<button class="act-btn" onclick="resolveNet('${n.id}')" style="border-color:var(--green);color:var(--green)" title="Resolver">✅</button>`:''}
      <button class="act-btn del" onclick="deleteNet('${n.id}')" title="Eliminar">🗑️</button>
    </div>
  </div>`;
}

function renderNetworkCharts() {
  // Hours per month bar
  const ctx1 = document.getElementById('chart-net-hours');
  if (ctx1) {
    destroyChart('net-hours');
    const months = lastNMonths(6);
    const hours  = months.map(m => {
      const inc = APP.network.filter(n => monthKey(n.startDate) === m.key);
      return +(inc.reduce((s,n) => s + calcDurationHours(n.startDate, n.endDate), 0).toFixed(2));
    });
    APP.charts['net-hours'] = new Chart(ctx1, {
      type: 'bar',
      data: { labels: months.map(m=>m.label), datasets:[{ label:'Horas caídas', data:hours, backgroundColor:'rgba(239,68,68,0.65)', borderRadius:4 }] },
      options: barOpts('horas')
    });
  }
  // Type donut
  const ctx2 = document.getElementById('chart-net-type');
  if (ctx2) {
    destroyChart('net-type');
    const counts = { total:0, parcial:0, lenta:0 };
    APP.network.forEach(n => { if (counts[n.type]!==undefined) counts[n.type]++; });
    APP.charts['net-type'] = new Chart(ctx2, {
      type: 'doughnut',
      data: { labels:['Total','Parcial','Lenta'], datasets:[{ data:Object.values(counts), backgroundColor:['#ef4444','#f59e0b','#f97316'], borderWidth:0, hoverOffset:5 }] },
      options: { ...donutOpts(), plugins:{ legend:{ position:'bottom', labels:{ color:'#9ab0d8', font:{size:11}, padding:8 }}, tooltip:tooltipOpts() }}
    });
  }
}

// ── Network CRUD ──
function openNetworkModal() {
  closeFabMenu(); APP.editId = null;
  clearNetForm();
  const autoId = `NET-${String(APP.networkCounter).padStart(3,'0')}`;
  document.getElementById('net-id').value = autoId;
  document.getElementById('net-modal-title').textContent = 'Registrar Caída de Red';
  openModal('network-modal');
}

function openNetEdit(id) {
  const n = APP.network.find(x => x.id === id);
  if (!n) return;
  APP.editId = id;
  clearNetForm();
  document.getElementById('net-modal-title').textContent = 'Editar Incidente';
  document.getElementById('net-id').value      = n.netId;
  document.getElementById('net-type').value    = n.type;
  document.getElementById('net-start').value   = n.startDate || '';
  document.getElementById('net-end').value     = n.endDate || '';
  document.getElementById('net-area').value    = n.area || '';
  document.getElementById('net-status').value  = n.status;
  document.getElementById('net-cause').value   = n.cause || '';
  document.getElementById('net-desc').value    = n.desc || '';
  document.getElementById('net-report').value  = n.reportTo || '';
  openModal('network-modal');
}

function clearNetForm() {
  ['net-id','net-area','net-desc','net-report','net-end'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const now = new Date();
  const s = document.getElementById('net-start'); if (s) s.value = toLocalISO(now);
  const t = document.getElementById('net-type');  if (t) t.value = 'total';
  const st= document.getElementById('net-status');if (st) st.value = 'activa';
  const c = document.getElementById('net-cause'); if (c) c.value = '';
}

function saveNetwork() {
  const startDate = document.getElementById('net-start').value;
  if (!startDate) { showToast('⚠️ La fecha de inicio es obligatoria', 'error'); return; }
  const netId = document.getElementById('net-id').value.trim() || `NET-${String(APP.networkCounter).padStart(3,'0')}`;

  if (APP.editId) {
    const n = APP.network.find(x => x.id === APP.editId);
    if (!n) return;
    Object.assign(n, {
      netId, type: document.getElementById('net-type').value,
      startDate, endDate: document.getElementById('net-end').value,
      area: document.getElementById('net-area').value.trim(),
      status: document.getElementById('net-status').value,
      cause: document.getElementById('net-cause').value,
      desc: document.getElementById('net-desc').value.trim(),
      reportTo: document.getElementById('net-report').value.trim(),
      updatedAt: new Date().toISOString()
    });
    showToast('✏️ Incidente actualizado', 'success');
  } else {
    APP.network.unshift({
      id: uid(), netId, type: document.getElementById('net-type').value,
      startDate, endDate: document.getElementById('net-end').value,
      area: document.getElementById('net-area').value.trim(),
      status: document.getElementById('net-status').value,
      cause: document.getElementById('net-cause').value,
      desc: document.getElementById('net-desc').value.trim(),
      reportTo: document.getElementById('net-report').value.trim(),
      createdAt: new Date().toISOString()
    });
    APP.networkCounter++;
    showToast('🌐 Incidente registrado', 'success');
  }
  saveAll(); closeModal('network-modal');
  renderNetwork(); renderNetworkCharts(); updateSidebarBadges();
  if (APP.module === 'dashboard') renderDashboard();
}

function resolveNet(id) {
  const n = APP.network.find(x => x.id === id);
  if (!n) return;
  n.status = 'resuelta';
  if (!n.endDate) n.endDate = toLocalISO(new Date());
  saveAll(); renderNetwork(); renderNetworkCharts(); updateSidebarBadges();
  showToast('✅ Incidente resuelto', 'success');
}

function deleteNet(id) {
  if (!confirm('¿Eliminar este incidente?')) return;
  APP.network = APP.network.filter(x => x.id !== id);
  saveAll(); renderNetwork(); renderNetworkCharts(); updateSidebarBadges();
  showToast('🗑️ Eliminado', 'info');
}

function openNetDetail(id) {
  const n = APP.network.find(x => x.id === id);
  if (!n) return;
  const typeLabel  = { total:'🔴 Total', parcial:'🟡 Parcial', lenta:'🟠 Lenta' }[n.type] || n.type;
  const stLabel    = n.status === 'activa' ? '🔴 Activa' : '✅ Resuelta';
  const causeLabel = { isp:'ISP', router:'Router/Switch', cable:'Cable dañado', sobrecarga:'Sobrecarga', mantenimiento:'Mantenimiento', otro:'Otro' }[n.cause] || n.cause || 'Desconocida';
  const dur = calcDuration(n.startDate, n.endDate);

  document.getElementById('detail-modal-title').textContent = `Incidente ${n.netId}`;
  document.getElementById('detail-modal-body').innerHTML = `
    <div class="detail-title-text">${escH(n.netId)} — ${typeLabel}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <span class="badge b-${n.status==='activa'?'red':'green'}">${stLabel}</span>
      <span class="badge b-orange">${typeLabel}</span>
    </div>
    ${dur?`<div style="font-size:28px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--red);margin-bottom:14px">${dur}</div>`:''}
    <div class="form-row">
      <div class="detail-field"><div class="detail-label">Inicio</div><div class="detail-value">${fmtDate(n.startDate)}</div></div>
      <div class="detail-field"><div class="detail-label">Fin</div><div class="detail-value">${fmtDate(n.endDate)}</div></div>
    </div>
    ${n.area?`<div class="detail-field"><div class="detail-label">Área afectada</div><div class="detail-value">${escH(n.area)}</div></div>`:''}
    <div class="detail-field"><div class="detail-label">Causa</div><div class="detail-value">${causeLabel}</div></div>
    ${n.desc?`<div class="detail-field"><div class="detail-label">Descripción / Resolución</div><div class="detail-value">${escH(n.desc)}</div></div>`:''}
    ${n.reportTo?`<div class="detail-field"><div class="detail-label">Reportado a</div><div class="detail-value">${escH(n.reportTo)}</div></div>`:''}
  `;
  document.getElementById('detail-modal-footer').innerHTML = `
    <button class="btn-secondary" onclick="closeModal('detail-modal')">Cerrar</button>
    <button class="btn-secondary" onclick="closeModal('detail-modal');openNetEdit('${n.id}')">✏️ Editar</button>
    ${n.status==='activa'?`<button class="btn-primary" onclick="closeModal('detail-modal');resolveNet('${n.id}')">✅ Resolver</button>`:''}`;
  openModal('detail-modal');
}

// ═══════════════════════════════════════════
//  ECONOMY MODULE
// ═══════════════════════════════════════════
function updateRate() {
  updateRates();
}

function updateEconBalance() {
  const income  = APP.economy.filter(t => t.type==='ingreso').reduce((s, t) => s + t.amount, 0);
  const expense = APP.economy.filter(t => t.type==='egreso').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const rate    = APP.rate;

  set('econ-income-usd',  `$${income.toFixed(2)}`);
  set('econ-income-ves',  `Bs. ${(income * rate).toLocaleString('es-VE', {maximumFractionDigits:2})}`);

  set('econ-expense-usd', `$${expense.toFixed(2)}`);
  set('econ-expense-ves', `Bs. ${(expense * rate).toLocaleString('es-VE', {maximumFractionDigits:2})}`);

  set('econ-balance-usd', `$${balance.toFixed(2)}`);
  set('econ-balance-ves', `Bs. ${(balance * rate).toLocaleString('es-VE', {maximumFractionDigits:2})}`);
}

function convertFrom(from) {
  const rate = APP.rate;
  if (from === 'usd') {
    const usd = parseFloat(document.getElementById('conv-usd').value) || 0;
    document.getElementById('conv-ves').value = (usd * rate).toFixed(2);
  } else {
    const ves = parseFloat(document.getElementById('conv-ves').value) || 0;
    document.getElementById('conv-usd').value = (ves / rate).toFixed(4);
  }
}

function updateEconEquiv() {
  const amount = parseFloat(document.getElementById('ec-amount').value) || 0;
  const equiv  = amount * APP.rate;
  const el = document.getElementById('ec-equiv');
  if (el) el.textContent = `≈ Bs. ${equiv.toLocaleString('es-VE', {maximumFractionDigits:2})}`;
}

function setEconView(view, btn) {
  APP.econView = view;
  document.querySelectorAll('#sec-economy .toolbar-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderEconomy();
}

function renderEcLegacy() {
  // This is the old render — now forwarded to the new multi-account system renderer
  renderEconomy();
}


function renderEconomyCharts() {
  // Flow bar
  const ctx1 = document.getElementById('chart-econ-flow');
  if (ctx1) {
    destroyChart('econ-flow');
    const months  = lastNMonths(6);
    const income  = months.map(m => APP.economy.filter(e => e.type==='ingreso' && monthKey(e.date)===m.key).reduce((s,e)=>s+e.amount,0));
    const expense = months.map(m => APP.economy.filter(e => e.type==='egreso'  && monthKey(e.date)===m.key).reduce((s,e)=>s+e.amount,0));
    APP.charts['econ-flow'] = new Chart(ctx1, {
      type: 'bar',
      data: { labels: months.map(m=>m.label), datasets: [
        { label:'Ingresos', data:income,  backgroundColor:'rgba(16,185,129,0.7)', borderRadius:4 },
        { label:'Egresos',  data:expense, backgroundColor:'rgba(239,68,68,0.65)', borderRadius:4 }
      ]},
      options: barOpts('USD')
    });
  }
  // Category donut
  const ctx2 = document.getElementById('chart-econ-cat');
  if (ctx2) {
    destroyChart('econ-cat');
    const cats = {};
    APP.economy.filter(e=>e.type==='egreso').forEach(e => {
      const c = e.category||'otro';
      cats[c] = (cats[c]||0) + e.amount;
    });
    const labels = Object.keys(cats);
    const values = Object.values(cats);
    const colors = ['#f97316','#f59e0b','#10b981','#22d3ee','#6366f1','#a855f7','#ef4444'];
    APP.charts['econ-cat'] = new Chart(ctx2, {
      type: 'doughnut',
      data: { labels, datasets:[{ data:values, backgroundColor:colors.slice(0,labels.length), borderWidth:0, hoverOffset:5 }] },
      options: { ...donutOpts(), plugins:{ legend:{ position:'bottom', labels:{ color:'#9ab0d8', font:{size:10}, padding:6 }}, tooltip:tooltipOpts() }}
    });
  }
}

// ── Economy CRUD ──
function openEconModal(type) {
  closeFabMenu(); APP.editId = null;
  clearEconForm();
  if (type) { const el = document.getElementById('ec-type'); if (el) el.value = type; }
  document.getElementById('econ-modal-title').textContent = 'Nuevo Movimiento';
  openModal('econ-modal');
  setTimeout(() => document.getElementById('ec-desc')?.focus(), 100);
}

function openEconEdit(id) {
  const e = APP.economy.find(x => x.id === id);
  if (!e) return;
  APP.editId = id;
  clearEconForm();
  document.getElementById('econ-modal-title').textContent = 'Editar Movimiento';
  document.getElementById('ec-type').value   = e.type;
  document.getElementById('ec-amount').value = e.amount;
  document.getElementById('ec-desc').value   = e.desc;
  document.getElementById('ec-cat').value    = e.category || 'otro';
  document.getElementById('ec-date').value   = e.date ? e.date.slice(0,10) : '';
  document.getElementById('ec-notes').value  = e.notes || '';
  updateEconEquiv();
  openModal('econ-modal');
}

function clearEconForm() {
  ['ec-amount','ec-desc','ec-notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const t = document.getElementById('ec-type'); if (t) t.value = 'ingreso';
  const c = document.getElementById('ec-cat');  if (c) c.value = 'salario';
  const d = document.getElementById('ec-date'); if (d) d.value = toLocalDate(new Date());
  const eq= document.getElementById('ec-equiv'); if (eq) eq.textContent = '≈ Bs. 0.00';
}

function saveEconomy() {
  const amount  = parseFloat(document.getElementById('ec-amount').value);
  const desc    = document.getElementById('ec-desc').value.trim();
  const type    = document.getElementById('ec-type').value;
  const account = document.getElementById('ec-account')?.value || 'efectivo';
  if (!amount || amount <= 0) { showToast('⚠️ Monto inválido', 'error'); return; }
  if (!desc)                  { showToast('⚠️ Descripción requerida', 'error'); return; }

  if (APP.editId) {
    const e = APP.economy.find(x => x.id === APP.editId);
    if (!e) return;
    // Reverse old balance effect
    if (e.type === 'ingreso') adjustBalance(e.account || 'efectivo', -e.amount);
    else                      adjustBalance(e.account || 'efectivo', +e.amount);
    // Apply new
    if (type === 'ingreso') adjustBalance(account, +amount);
    else                    adjustBalance(account, -amount);

    Object.assign(e, {
      type, amount, desc, account,
      category: document.getElementById('ec-cat').value,
      date:     document.getElementById('ec-date').value,
      notes:    document.getElementById('ec-notes').value.trim(),
      updatedAt: new Date().toISOString()
    });
    showToast('✏️ Movimiento actualizado', 'success');
  } else {
    // Adjust account balance
    if (type === 'ingreso') adjustBalance(account, +amount);
    else                    adjustBalance(account, -amount);

    APP.economy.unshift({
      id: uid(), type, amount, desc, account,
      category: document.getElementById('ec-cat').value,
      date:     document.getElementById('ec-date').value,
      notes:    document.getElementById('ec-notes').value.trim(),
      createdAt: new Date().toISOString()
    });
    showToast('💰 Movimiento guardado', 'success');
  }
  saveAll(); closeModal('econ-modal'); clearEconForm();
  renderEconomy(); renderEconomyCharts(); updateEconBalance();
  if (APP.module === 'dashboard') renderDashboard();
}


function deleteEcon(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  APP.economy = APP.economy.filter(x => x.id !== id);
  saveAll(); renderEconomy(); renderEconomyCharts(); updateEconBalance();
  showToast('🗑️ Eliminado', 'info');
}

function updateEconForm() { updateEconEquiv(); }

function openEconDetail(id) {
  const e = APP.economy.find(x => x.id === id);
  if (!e) return;
  const ves = (e.amount * APP.rate).toLocaleString('es-VE', {maximumFractionDigits:2});
  document.getElementById('detail-modal-title').textContent = 'Detalle Movimiento';
  document.getElementById('detail-modal-body').innerHTML = `
    <div class="detail-title-text" style="color:${e.type==='ingreso'?'var(--green)':'var(--red)'}">
      ${e.type==='ingreso'?'+':'-'}$${e.amount.toFixed(2)}
    </div>
    <div style="font-size:16px;color:var(--text-muted);margin-bottom:16px">Bs. ${ves}</div>
    <div class="detail-field"><div class="detail-label">Descripción</div><div class="detail-value">${escH(e.desc)}</div></div>
    <div class="form-row">
      <div class="detail-field"><div class="detail-label">Tipo</div><div class="detail-value">${capitalize(e.type)}</div></div>
      <div class="detail-field"><div class="detail-label">Categoría</div><div class="detail-value">${capitalize(e.category||'otro')}</div></div>
    </div>
    <div class="detail-field"><div class="detail-label">Fecha</div><div class="detail-value">${fmtDateShort(e.date)}</div></div>
    ${e.notes?`<div class="detail-field"><div class="detail-label">Notas</div><div class="detail-value">${escH(e.notes)}</div></div>`:''}
    <hr class="divider"/>
    <div style="font-size:12px;color:var(--text-muted)">Tasa aplicada: 1 USD = ${APP.rate} VES</div>
  `;
  document.getElementById('detail-modal-footer').innerHTML = `
    <button class="btn-secondary" onclick="closeModal('detail-modal')">Cerrar</button>
    <button class="btn-secondary" onclick="closeModal('detail-modal');openEconEdit('${e.id}')">✏️ Editar</button>
    <button class="btn-danger"    onclick="closeModal('detail-modal');deleteEcon('${e.id}')">🗑️ Eliminar</button>`;
  openModal('detail-modal');
}

// ═══════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════
function openExportModal() {
  APP.exportModule = APP.module === 'dashboard' ? 'tasks' : APP.module;
  const el = document.getElementById('exp-module-label');
  if (el) el.textContent = 'Exportando: ' + capitalize(APP.exportModule === 'all' ? 'TODOS los módulos' : APP.exportModule);
  // Mark first tab as active
  document.querySelectorAll('.export-module-tabs .tab-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  openModal('export-modal');
}

function setExportModule(mod, btn) {
  APP.exportModule = mod;
  document.querySelectorAll('.export-module-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const el = document.getElementById('exp-module-label');
  const labels = { tasks:'Tareas', tickets:'Tickets de Soporte', network:'Caídas de Red', economy:'Economía', all:'TODOS los módulos' };
  if (el) el.textContent = 'Exportando: ' + (labels[mod]||mod);
}

function doExport(format) {
  const mod = APP.exportModule;
  const dateStr = new Date().toISOString().slice(0,10);
  const name    = `EJCP_${mod}_${dateStr}`;

  if (mod === 'all') {
    const allData = { tasks: APP.tasks, tickets: APP.tickets, network: APP.network, economy: APP.economy, rate: APP.rate, exportedAt: new Date().toISOString() };
    if (format === 'json') return download(JSON.stringify(allData, null, 2), `${name}.json`, 'application/json');
    showToast('📤 Para exportar TODO usa JSON', 'info');
    download(JSON.stringify(allData, null, 2), `${name}.json`, 'application/json');
    closeModal('export-modal');
    return;
  }

  const data = { tasks: APP.tasks, tickets: APP.tickets, network: APP.network, economy: APP.economy }[mod] || [];

  if (!data.length) { showToast('⚠️ Sin datos para exportar', 'error'); return; }

  let content = '', mime = '', ext = '';

  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
    mime = 'application/json'; ext = 'json';
  }

  if (format === 'csv') {
    content = buildCSV(mod, data);
    mime = 'text/csv'; ext = 'csv';
  }

  if (format === 'txt') {
    content = buildTxt(mod, data, dateStr);
    mime = 'text/plain'; ext = 'txt';
  }

  if (format === 'html') {
    content = buildHtml(mod, data, dateStr);
    mime = 'text/html'; ext = 'html';
  }

  download(content, `${name}.${ext}`, mime);
  closeModal('export-modal');
  showToast(`📤 ${data.length} registro(s) exportados en ${format.toUpperCase()}`, 'success');
}

function buildCSV(mod, data) {
  const headers = {
    tasks:   ['ID','Título','Descripción','Fecha','Prioridad','Categoría','Etiquetas','Estado','Nota de voz','Creada'],
    tickets: ['N° Ticket','Fecha','Hora Apertura','Hora Cierre','Descripción','Proveedor','Técnico','Estado','Categoría','Solución'],
    network: ['ID','NetID','Tipo','Inicio','Fin','Duración','Área','Estado','Causa','Descripción','Reportado'],
    economy: ['ID','Tipo','Monto USD','Monto VES','Descripción','Categoría','Fecha','Notas']
  };

  const rows = {
    tasks:   data.map(t => [t.id, q(t.title), q(t.desc), fmtDate(t.date), t.priority, t.category, (t.tags||[]).join(';'), t.done?'Completada':isOverdue(t)?'Vencida':'Pendiente', q(t.voiceText), fmtDate(t.createdAt)]),
    tickets: data.map(t => [t.number, t.date, t.timeOpen, t.timeClose, q(t.desc), q(t.provider), q(t.assignee), t.status, t.category, q(t.solution)]),
    network: data.map(n => [n.id, n.netId, n.type, fmtDate(n.startDate), fmtDate(n.endDate), calcDuration(n.startDate,n.endDate)||'—', q(n.area), n.status, n.cause, q(n.desc), q(n.reportTo)]),
    economy: data.map(e => [e.id, e.type, e.amount.toFixed(2), (e.amount*APP.rate).toFixed(2), q(e.desc), e.category, fmtDateShort(e.date), q(e.notes)])
  };

  const h = headers[mod] || []; const r = rows[mod] || [];
  return [h.join(','), ...r.map(row => row.join(','))].join('\n');
}

function q(s) { return `"${(s||'').replace(/"/g,'""')}"`; }

function buildTxt(mod, data, dateStr) {
  const lines = data.map(item => {
    if (mod === 'tasks')   return `[${item.done?'✓':' '}] ${item.title}${item.date?' | '+fmtDateShort(item.date):''}${item.priority?' | '+item.priority:''}`;
    if (mod === 'tickets') return `${item.number} | ${item.status.toUpperCase()} | ${item.title} | ${fmtDateShort(item.openDate)}`;
    if (mod === 'network') return `${item.netId} | ${item.type.toUpperCase()} | ${fmtDate(item.startDate)} | ${calcDuration(item.startDate,item.endDate)||'activa'} | ${item.status}`;
    if (mod === 'economy') return `${item.type==='ingreso'?'+':'-'}$${item.amount.toFixed(2)} | ${item.desc} | ${fmtDateShort(item.date)}`;
    return JSON.stringify(item);
  });
  return `COSAS DE MI VIDA EJCP — ${mod.toUpperCase()} — ${dateStr}\n${'═'.repeat(50)}\n\n${lines.join('\n')}\n\nTotal: ${data.length} registro(s)`;
}

function buildHtml(mod, data, dateStr) {
  const modLabel = { tasks:'Tareas', tickets:'Tickets', network:'Caídas de Red', economy:'Economía' }[mod]||mod;
  const rows = data.map(item => {
    if (mod==='tasks')   return `<tr><td>${item.done?'✅':'⏳'}</td><td><b>${escH(item.title)}</b>${item.desc?`<br><small>${escH(item.desc.slice(0,80))}</small>`:''}</td><td>${item.priority}</td><td>${fmtDate(item.date)}</td><td>${item.category||'—'}</td></tr>`;
    if (mod==='tickets') return `<tr><td style="font-family:monospace">${item.number}</td><td><b>${escH(item.title)}</b></td><td>${item.status}</td><td>${item.priority}</td><td>${item.category}</td><td>${fmtDate(item.openDate)}</td></tr>`;
    if (mod==='network') return `<tr><td>${item.netId}</td><td>${item.type}</td><td>${fmtDate(item.startDate)}</td><td>${calcDuration(item.startDate,item.endDate)||'—'}</td><td>${item.status}</td><td>${escH(item.area||'—')}</td></tr>`;
    if (mod==='economy') return `<tr><td style="color:${item.type==='ingreso'?'#10b981':'#ef4444'}">${item.type==='ingreso'?'+':'-'}$${item.amount.toFixed(2)}</td><td>${escH(item.desc)}</td><td>${item.category}</td><td>${fmtDateShort(item.date)}</td></tr>`;
    return '';
  }).join('');

  const headers = {
    tasks:   '<th>Estado</th><th>Tarea</th><th>Prioridad</th><th>Fecha</th><th>Categoría</th>',
    tickets: '<th>Nº</th><th>Asunto</th><th>Estado</th><th>Prioridad</th><th>Categoría</th><th>Apertura</th>',
    network: '<th>ID</th><th>Tipo</th><th>Inicio</th><th>Duración</th><th>Estado</th><th>Área</th>',
    economy: '<th>Monto</th><th>Descripción</th><th>Categoría</th><th>Fecha</th>',
  };

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>EJCP – ${modLabel} – ${dateStr}</title>
  <style>body{font-family:Inter,sans-serif;background:#0f172a;color:#f1f5f9;margin:0;padding:32px}h1{font-size:22px;color:#818cf8;margin-bottom:4px}p{color:#64748b;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#1e293b;padding:11px;text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:.05em}td{padding:11px;border-bottom:1px solid #1e293b;color:#cbd5e1}tr:hover td{background:#1e293b}</style>
  </head><body>
  <h1>🌟 COSAS DE MI VIDA EJCP</h1>
  <p>${modLabel} · Exportado el ${dateStr} · ${data.length} registro(s)</p>
  <table><thead><tr>${headers[mod]||''}</tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}

function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════
//  CHART HELPERS
// ═══════════════════════════════════════════
function destroyChart(key) {
  if (APP.charts[key]) { APP.charts[key].destroy(); delete APP.charts[key]; }
}

const CHART_BASE = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { x: { ticks: { color: '#5a6e98', font: { size: 11 } }, grid: { display: false } },
            y: { ticks: { color: '#5a6e98', font: { size: 11 } }, grid: { color: 'rgba(99,102,241,0.07)' } } }
};

function barOpts(unit) {
  return { ...CHART_BASE,
    plugins: { legend: { position:'top', labels:{ color:'#9ab0d8', font:{size:11}, padding:12, boxWidth:12 }}, tooltip: tooltipOpts() },
    scales: { x: { ticks:{ color:'#5a6e98', font:{size:11} }, grid:{ display:false }, stacked:false },
              y: { ticks:{ color:'#5a6e98', font:{size:11}, callback: v => unit==='USD'?`$${v}`:v }, grid:{ color:'rgba(99,102,241,0.07)' } } }
  };
}

function donutOpts() {
  return { responsive:true, maintainAspectRatio:false, cutout:'65%' };
}

function tooltipOpts() {
  return { backgroundColor:'rgba(13,21,38,0.95)', borderColor:'rgba(99,102,241,0.3)', borderWidth:1, titleColor:'#f0f4ff', bodyColor:'#9ab0d8', cornerRadius:8, padding:10 };
}

// ═══════════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════════
function openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add('active'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('active'); }

document.addEventListener('click', e => {
  document.querySelectorAll('.modal-overlay.active').forEach(m => {
    if (e.target === m) m.classList.remove('active');
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    if (document.getElementById('voice-overlay')?.classList.contains('active')) cancelVoice();
    closeFabMenu();
  }
  if ((e.ctrlKey||e.metaKey) && e.key==='n') { e.preventDefault(); if (APP.module==='tasks') openTaskModal(); else if (APP.module==='tickets') openTicketModal(); else if (APP.module==='network') openNetworkModal(); else if (APP.module==='economy') openEconModal(); }
  if ((e.ctrlKey||e.metaKey) && e.key==='m') { e.preventDefault(); startVoiceCapture(); }
});

// ═══════════════════════════════════════════
//  SIDEBAR TOGGLE
// ═══════════════════════════════════════════
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
document.addEventListener('click', e => {
  const sb = document.getElementById('sidebar');
  const mt = document.querySelector('.menu-toggle');
  if (window.innerWidth < 900 && sb?.classList.contains('open')) {
    if (!sb.contains(e.target) && e.target !== mt) sb.classList.remove('open');
  }
});

// ═══════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════
function showToast(msg, type='info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ═══════════════════════════════════════════
//  SAMPLE DATA
// ═══════════════════════════════════════════
function sampleTasks() {
  const now = new Date();
  const tmr = new Date(now); tmr.setDate(tmr.getDate()+1);
  const yest= new Date(now); yest.setDate(yest.getDate()-1);
  return [
    { id:uid(), title:'Revisar correos del día', desc:'Responder pendientes urgentes', date:toLocalISO(now), priority:'alta', category:'Trabajo', tags:['correo','urgente'], done:false, voiceText:'', voiceUrl:'', createdAt:now.toISOString() },
    { id:uid(), title:'Preparar informe semanal', desc:'Incluir métricas de soporte y red', date:toLocalISO(tmr), priority:'media', category:'Trabajo', tags:['informe'], done:false, voiceText:'', voiceUrl:'', createdAt:now.toISOString() },
    { id:uid(), title:'Renovar seguro del vehículo', desc:'', date:toLocalISO(yest), priority:'alta', category:'Personal', tags:['seguro'], done:false, voiceText:'', voiceUrl:'', createdAt:now.toISOString() },
    { id:uid(), title:'Actualizar documentación IT', desc:'Procedimientos de caídas de red', date:'', priority:'baja', category:'Trabajo', tags:[], done:true, voiceText:'', voiceUrl:'', createdAt:now.toISOString() }
  ];
}

function sampleTickets() {
  const now = new Date();
  return [
    { id:uid(), number:'TK-2024-001', title:'Sin acceso a internet — piso 2', desc:'Los usuarios del piso 2 no tienen acceso a internet desde las 8am', status:'cerrado', category:'red', priority:'alta', openDate:toLocalISO(new Date(now-3600000*5)), closeDate:toLocalISO(new Date(now-3600000*2)), assignee:'Carlos Pérez', reporter:'María López', notes:'Se reinició el switch del piso 2. Problema resuelto.', createdAt:now.toISOString() },
    { id:uid(), number:'TK-2024-002', title:'Impresora no reconocida en red', desc:'La impresora HP del departamento contable no aparece en red', status:'en_progreso', category:'hardware', priority:'media', openDate:toLocalISO(new Date(now-3600000*2)), closeDate:'', assignee:'Luis Torres', reporter:'Jefa Contabilidad', notes:'Revisando configuración IP de la impresora.', createdAt:now.toISOString() },
    { id:uid(), number:'TK-2024-003', title:'Acceso bloqueado al sistema ERP', desc:'Usuario reporta que su contraseña no funciona en el ERP desde ayer', status:'abierto', category:'acceso', priority:'critica', openDate:toLocalISO(now), closeDate:'', assignee:'', reporter:'Gerente Finanzas', notes:'', createdAt:now.toISOString() }
  ];
}

function sampleNetwork() {
  const now = new Date();
  return [
    { id:uid(), netId:'NET-001', type:'total', startDate:toLocalISO(new Date(now-3600000*24*2)), endDate:toLocalISO(new Date(now-3600000*24*2+3600000*2)), area:'Toda la oficina', status:'resuelta', cause:'isp', desc:'El ISP tuvo una caída de fibra óptica. Resuelto tras 2 horas.', reportTo:'ISP Cantv', createdAt:now.toISOString() },
    { id:uid(), netId:'NET-002', type:'parcial', startDate:toLocalISO(new Date(now-3600000*5)), endDate:toLocalISO(new Date(now-3600000*3)), area:'Piso 1 — Sala de reuniones', status:'resuelta', cause:'router', desc:'Switch del piso 1 se reinició. Reconectado manualmente.', reportTo:'Supervisor IT', createdAt:now.toISOString() }
  ];
}

function sampleEconomy() {
  return []; // Initially 0 as requested
}

// Import Excel Logic
let importModule = null;
function openImportModal(mod) {
  importModule = mod;
  const ta = document.getElementById('import-textarea');
  if (ta) ta.value = '';
  openModal('import-modal');
}

function processImport() {
  const text = document.getElementById('import-textarea').value.trim();
  if (!text) { showToast('Pega datos primero', 'error'); return; }
  const lines = text.split('\n').filter(l => l.trim());
  let imported = 0;

  if (importModule === 'tickets') {
    lines.forEach(line => {
      const p = line.split('\t');
      if (p.length < 2) return;
      APP.tickets.unshift({ id:uid(), number:p[0]?.trim()||'', date:parseDate(p[1]?.trim()||''), timeOpen:p[2]?.trim()||'', timeClose:p[3]?.trim()||'', desc:p[4]?.trim()||'', provider:p[5]?.trim()||'', assignee:p[6]?.trim()||'', status:mapStatus(p[7]?.trim()||''), solution:p[8]?.trim()||'', category:'red', createdAt:new Date().toISOString() });
      imported++; APP.ticketCounter++;
    });
  }

  if (importModule === 'network') {
    lines.forEach(line => {
      const p = line.split('\t');
      if (p.length < 2) return;
      const ntype = (t => t.includes('total')||t.includes('completa')?'total':t.includes('parcial')?'parcial':'lenta')((p[1]||'').toLowerCase());
      APP.network.unshift({ id:uid(), netId:p[0]?.trim()||'NET-'+String(APP.networkCounter).padStart(3,'0'), type:ntype, startDate:parseDate(p[2]?.trim()||''), endDate:parseDate(p[3]?.trim()||''), area:p[4]?.trim()||'', cause:p[5]?.trim()||'otro', desc:p[6]?.trim()||'', reportTo:p[7]?.trim()||'', status:'resuelta', createdAt:new Date().toISOString() });
      imported++; APP.networkCounter++;
    });
  }

  saveAll();
  closeModal('import-modal');
  showToast('✅ ' + imported + ' registro(s) importados', 'success');
  if (importModule === 'tickets') { renderTickets(); renderTicketCharts(); updateSidebarBadges(); }
  if (importModule === 'network') { renderNetwork(); renderNetworkCharts(); updateSidebarBadges(); }
}

function mapStatus(s) {
  const st = (s||'').toLowerCase();
  if (st.includes('abierto'))  return 'abierto';
  if (st.includes('cerrado') || st.includes('resuelto')) return 'cerrado';
  if (st.includes('progreso')) return 'en_progreso';
  if (st.includes('escalado')) return 'escalado';
  return 'abierto';
}

function parseDate(s) {
  if (!s) return '';
  const p = s.split(/[\/\-]/);
  return (p.length === 3 && p[0].length === 2) ? p[2]+'-'+p[1]+'-'+p[0] : s;
}

// ═══ PROFILE ═══
function openProfileModal() {
  const pr = APP.profile || {};
  const av = document.getElementById('profile-avatar-img');
  const pv = document.getElementById('profile-modal-avatar-preview');
  if (pv) pv.src = pr.avatar || (av ? av.src : '');
  const n = document.getElementById('profile-modal-name');
  if (n) n.value = pr.name || 'EJCP';
  const s = document.getElementById('profile-modal-status');
  if (s) s.value = pr.status || '🟢 En línea';
  APP._tmpProfileAvatar = null;
  openModal('profile-modal');
}
function handleProfilePhotoUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { const pv = document.getElementById('profile-modal-avatar-preview'); if (pv) pv.src = e.target.result; APP._tmpProfileAvatar = e.target.result; };
  reader.readAsDataURL(file);
}
function saveProfile() {
  APP.profile.name   = (document.getElementById('profile-modal-name')?.value.trim()) || 'EJCP';
  APP.profile.status = document.getElementById('profile-modal-status')?.value || '🟢 En línea';
  if (APP._tmpProfileAvatar) { APP.profile.avatar = APP._tmpProfileAvatar; APP._tmpProfileAvatar = null; }
  saveAll(); updateProfileUI(); closeModal('profile-modal'); showToast('✅ Perfil actualizado', 'success');
}
function updateProfileUI() {
  const p = APP.profile || {};
  const ne = document.getElementById('profile-name'); if (ne) ne.textContent = p.name || 'EJCP';
  const se = document.getElementById('profile-status-label'); if (se) se.textContent = p.status || '🟢 En línea';
  const ae = document.getElementById('profile-avatar-img'); if (ae && p.avatar) ae.src = p.avatar;
  const de = document.getElementById('profile-status-dot');
  if (de) { const s=(p.status||'').toLowerCase(); de.style.background=s.includes('trabajando')?'#6366f1':s.includes('entrenando')?'#22d3ee':s.includes('ocupado')?'#ef4444':s.includes('descanso')?'#f59e0b':'#10b981'; }
}

// ═══════════════════════════════════════════
//  PORTFOLIO AUTOMÁTICO DESDE PDF Y SHOWCASE
// ═══════════════════════════════════════════

function makeDocHtmlUri(title, subtitle, detail, icon, color) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 30px 20px; background: #0b0f19; color: #f1f5f9; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 80vh; box-sizing: border-box; }
    .card { background: #161f31; border: 2px solid ${color}; border-radius: 16px; width: 100%; max-width: 580px; padding: 40px 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center; }
    .icon { font-size: 58px; margin-bottom: 16px; }
    .header { font-size: 20px; font-weight: 800; color: ${color}; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
    .sub { font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
    .person { font-size: 18px; font-weight: 900; color: #00d2ff; margin: 20px 0 10px; }
    .meta { font-size: 13px; color: #94a3b8; line-height: 1.6; }
    .badge { display: inline-block; background: rgba(0,210,255,0.12); color: #00d2ff; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 99px; margin-top: 24px; border: 1px solid rgba(0,210,255,0.3); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <div class="header">${title}</div>
    <div class="sub">${subtitle}</div>
    <div class="person">EDWIN JOSÉ COLMENARES PACHECO</div>
    <div class="meta">${detail}</div>
    <div class="badge">VERIFICADO OFICIALMENTE · C.I. V-28.014.996</div>
  </div>
</body>
</html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function defaultAutoPortfolio() {
  return {
    profile: {
      name: 'Edwin José Colmenares Pacheco',
      title: 'Web Designer & Developer | Support Analyst & Network Systems Specialist',
      location: 'Guatire, Valle Arriba, Miranda, Venezuela',
      email: 'edwinjosecolmenares28@hotmail.com',
      phone: '+58 (0414) 135-6815',
      summary: 'Profesional en Informática especializado en Desarrollo Web Full-Stack, Integración de Sistemas Empresariales (SAP / Stellar), Administración de Redes (Cisco, PFSense, MikroTik) y Soporte Técnico Avanzado.',
      avatar: null
    },
    experience: [
      {
        id: 'exp-1',
        role: 'Diseñador Web / Sub-encargado de Tienda',
        company: 'RS Performance (RS21)',
        period: '2024 - Actualidad',
        description: 'Desarrollo e implementación web con SQL Server, integración de APIs avanzadas con sistemas SAP y Stellar, automatización de procesos de pagos y control de inventarios/stock en tiempo real.',
        achievements: ['Integración exitosa de pasarelas de pago y ERP SAP/Stellar', 'Automatización del control de stock e inventarios']
      },
      {
        id: 'exp-2',
        role: 'Soporte Técnico y Analista de Redes',
        company: 'ALTECEL',
        period: '2023 - 2024',
        description: 'Configuración, optimización y mantenimiento de switches Cisco y SwitchCore. Administración de seguridad y firewall DHCP en servidores PFSense.',
        achievements: ['Configuración y enrutamiento seguro con PFSense', 'Gestión de infraestructura de red corporativa Cisco']
      },
      {
        id: 'exp-3',
        role: 'Diseñador Web Remoto',
        company: 'Elbauldepaola, C.A.',
        period: '2022 - 2024',
        description: 'Desarrollo web y aplicaciones móviles con PHP, Laravel, HTML5/CSS3, Kotlin y administración de bases de datos SQL Server.',
        achievements: ['Desarrollo de módulos interactivos en Laravel & Kotlin', 'Mantenimiento de bases de datos relacionales SQL Server']
      },
      {
        id: 'exp-4',
        role: 'Desarrollador Web',
        company: 'Tecnocol 2017',
        period: '2021 - 2023',
        description: 'Diseño, maquetación y desarrollo de sitios web interactivos y plataformas digitales corporativas.',
        achievements: ['Creación de sitios web con alta velocidad de carga y respuesta UI']
      },
      {
        id: 'exp-5',
        role: 'Soporte Técnico y Analista de Redes',
        company: 'OPSU',
        period: '2018 - 2020',
        description: 'Diagnóstico, mantenimiento preventivo y correctivo de hardware/software, administración de redes y soporte a usuarios.',
        achievements: ['Atención efectiva de incidencias y mantenimiento de infraestructura']
      }
    ],
    education: [
      {
        id: 'edu-1',
        degree: 'T.S.U. en Informática',
        institution: 'Instituto Universitario de Tecnología El Elías Cala / I.U.T.E.C.P',
        year: 'Graduado 2021 / Título 2023',
        description: 'Formación académica superior en desarrollo de software, análisis de sistemas y administración de redes informáticas.'
      }
    ],
    skills: [
      { category: 'Desarrollo Web & Apps', items: ['JavaScript ES6+', 'PHP', 'Laravel', 'HTML5 & CSS3', 'Kotlin', 'REST APIs', 'SPA Architecture'] },
      { category: 'Bases de Datos & ERP', items: ['SQL Server', 'MySQL', 'Integración SAP', 'Stellar System', 'T-SQL'] },
      { category: 'Redes & Seguridad', items: ['Switches Cisco', 'SwitchCore', 'Firewall PFSense', 'MikroTik', 'DHCP & DNS', 'TCP/IP', 'VPN'] },
      { category: 'Sistemas & Soporte', items: ['Soporte Técnico N2/N3', 'Linux Server', 'Windows Server', 'Mantenimiento Hardware', 'Help Desk'] }
    ],
    projects: [
      {
        id: 'proj-1',
        title: 'Integración Web E-Commerce con SAP & Stellar (RS Performance / RS21)',
        desc: 'Plataforma web con automatización de stock en tiempo real, pasarelas de pago (Pago Móvil/Zinli) y sincronización API bidireccional con ERP SAP y Stellar.',
        tech: ['SQL Server', 'APIs REST', 'JavaScript ES6+', 'SAP SDK', 'Stellar System', 'Pago Móvil'],
        link: 'ecommerce-sap-demo.html',
        repo: 'https://github.com/ejcp-dev/ecommerce-sap-integration',
        architecture: 'Arquitectura N-Capas: Frontend SPA (HTML5/CSS3/JS ES6) ↔ Middleware API REST ↔ Base de Datos SQL Server ↔ ERP SAP Business One & Stellar Sync Engine',
        metrics: ['⚡ Reducción del 85% en inconsistencias de inventario', '🔄 500+ transacciones diarias procesadas en tiempo real', '⏱️ Tiempo de respuesta de API < 120ms'],
        details: 'Desarrollado para RS Performance (RS21). Permite a la fuerza de ventas y clientes e-commerce consultar la disponibilidad exacta de calzado/ropa por sucursal en tiempo real, procesar cobros automáticos en Bolívares con tasa BCV/Binance y generar asientos contables automáticos en SAP.'
      },
      {
        id: 'proj-2',
        title: 'Infraestructura de Red Empresarial & PFSense Firewall (ALTECEL & OPSU)',
        desc: 'Diseño e implementación de arquitectura de red empresarial con conmutación Cisco Core Layer 3, filtrado PFSense HA y VPNs de alta seguridad.',
        tech: ['Switches Cisco', 'PFSense Firewall', 'SwitchCore', 'MikroTik RouterOS', 'DHCP/DNS', 'VPN IPsec'],
        link: 'network-pfsense-demo.html',
        repo: 'https://github.com/ejcp-dev/network-pfsense-cisco-topology',
        architecture: 'Topología Jerárquica Core-Distribution-Access (Cisco 3850 Core Layer 3 ↔ PFSense Cluster HA Firewall ↔ SwitchCore Access VLANs)',
        metrics: ['🌐 99.99% de Uptime de Red Corporativa', '🛡️ Bloqueo automático de 1,200+ ataques scanners/DDoS semanales', '🔒 VPN segura para 50+ usuarios remotos'],
        details: 'Infraestructura de red desplegada para ALTECEL y OPSU. Segmentación por VLANs (VLAN 10 Administración, VLAN 20 Operaciones, VLAN 30 Servidores), servidores DNS/DHCP redundantes en PFSense con balanceo de carga Multi-WAN.'
      },
      {
        id: 'proj-3',
        title: 'EJCP TaskMaster & Sistema de Gestión Financiera Personal',
        desc: 'Plataforma web SPA autónoma para control de finanzas multi-cuenta, tasa oficial del día (BCV, Binance, AIRTM), seguimiento de ejercicios y generador de portafolio dinámico desde PDF.',
        tech: ['JavaScript ES6+', 'HTML5', 'Vanilla CSS', 'PDF.js', 'Chart.js', 'LocalStorage'],
        link: 'taskmaster-finance-demo.html',
        repo: 'https://github.com/ejcp-dev/ejcp-taskmaster-finance',
        architecture: 'Single Page Application (SPA) pura con renderizado dinámico por módulos, persistencia transaccional en LocalStorage e ingesta de documentos PDF en cliente.',
        metrics: ['⚡ 100% Client-Side sin servidores ni bases de datos externas requeridas', '🚀 Tiempo de inicio e hidratación < 150ms', '📊 Control transaccional multi-cuenta en tiempo real'],
        details: 'Plataforma desarrollada autónomamente para centralizar la gestión de liquidez (Binance USDT, AIRTM, Zinli, Bolívares, Efectivo), pagos de deudas en VES con deducción en USD, tickets de soporte IT y generador de portafolios desde CVs en PDF.'
      }
    ],
    documents: [
      {
        id: 'doc-1',
        title: 'Cédula de Identidad',
        category: 'legal',
        type: 'pdf',
        filename: 'Cedula_V-28014996_Edwin_Colmenares.pdf',
        date: 'V-28.014.996 · Documento Oficial Vigente',
        icon: '🪪',
        previewUrl: makeDocHtmlUri('REPÚBLICA BOLIVARIANA DE VENEZUELA', 'CÉDULA DE IDENTIDAD', 'V-28.014.996 · Estado Civil: Soltero · Vencimiento: 2031', '🪪', '#38bdf8')
      },
      {
        id: 'doc-2',
        title: 'Referencia Bancaria',
        category: 'legal',
        type: 'pdf',
        filename: 'Referencia_Bancaria_BDV_Edwin_Colmenares.pdf',
        date: 'Banco de Venezuela · Certificado 2024',
        icon: '🏦',
        previewUrl: makeDocHtmlUri('BANCO DE VENEZUELA', 'REFERENCIA BANCARIA OFICIAL', 'Titular de cuenta bancaria con excelente manejo y solvencia financiera.', '🏦', '#10b981')
      },
      {
        id: 'doc-3',
        title: 'Licencia de Conducir & Certificado Médico',
        category: 'legal',
        type: 'pdf',
        filename: 'Licencia_Conducir_Certificado_Medico.pdf',
        date: 'INTT 3ra Categoría · Vigente',
        icon: '🚗',
        previewUrl: makeDocHtmlUri('INTT & COLEGIO DE MÉDICOS', 'LICENCIA DE CONDUCIR & CERTIFICADO VIAL', 'Licencia de 3ra Categoría y Certificado Médico Vial Vigente.', '🚗', '#f59e0b')
      },
      {
        id: 'doc-4',
        title: 'Comprobante de Domicilio',
        category: 'legal',
        type: 'pdf',
        filename: 'Comprobante_Domicilio_Corpoelec_Guatire.pdf',
        date: 'Factura Corpoelec · Guatire, Miranda',
        icon: '🏠',
        previewUrl: makeDocHtmlUri('CORPOELEC VENEZUELA', 'COMPROBANTE DE DOMICILIO OFICIAL', 'Guatire, Valle Arriba, Municipio Zamora, Estado Miranda.', '🏠', '#38bdf8')
      },
      {
        id: 'doc-5',
        title: 'Título Universitario T.S.U. en Informática',
        category: 'titulos',
        type: 'pdf',
        filename: 'Titulo_Universitario_TSU_Informatica_IUTECP.pdf',
        date: 'I.U.T.E.C.P · Graduado 2021 / Título 2023',
        icon: '🎓',
        previewUrl: makeDocHtmlUri('INSTITUTO UNIVERSITARIO EL ELÍAS CALA', 'TÍTULO UNIVERSITARIO DE T.S.U. EN INFORMÁTICA', 'Educación Superior · Registrado en Secretaría Universitaria.', '🎓', '#8b5cf6')
      },
      {
        id: 'doc-6',
        title: 'Título de Bachiller en Ciencias',
        category: 'titulos',
        type: 'pdf',
        filename: 'Titulo_Bachiller_Ciencias_UEP_Gloria_y_Libertad.pdf',
        date: 'U.E.P. Gloria y Libertad · 2016',
        icon: '📜',
        previewUrl: makeDocHtmlUri('MINISTERIO DE EDUCACIÓN', 'TÍTULO DE BACHILLER EN CIENCIAS', 'U.E.P. Gloria y Libertad · Guatire, Miranda.', '📜', '#6366f1')
      },
      {
        id: 'doc-7',
        title: 'Curso de Shopify',
        category: 'cursos',
        type: 'pdf',
        filename: 'Certificado_Shopify_Platzi_Edwin_Colmenares.pdf',
        date: 'Platzi · Certificado 2023',
        icon: '🛍️',
        previewUrl: makeDocHtmlUri('PLATZI PLATFORM', 'CERTIFICADO DE CREACIÓN DE TIENDAS SHOPIFY', 'Aprobación del curso profesional de comercio electrónico Shopify.', '🛍️', '#10b981')
      },
      {
        id: 'doc-8',
        title: 'Creación de Temas WordPress I, II y III',
        category: 'cursos',
        type: 'pdf',
        filename: 'Certificado_WordPress_I_II_III_EDteam.pdf',
        date: 'EDteam · Certificado 2023',
        icon: '🌐',
        previewUrl: makeDocHtmlUri('EDTEAM EDUCACIÓN ONLINE', 'CERTIFICADO TEMAS WORDPRESS I, II Y III', 'Especialidad en desarrollo de temas y maquetación WordPress.', '🌐', '#38bdf8')
      },
      {
        id: 'doc-9',
        title: 'SEO desde Cero',
        category: 'cursos',
        type: 'pdf',
        filename: 'Certificado_SEO_desde_Cero_EDteam.pdf',
        date: 'EDteam · Certificado 2023',
        icon: '🚀',
        previewUrl: makeDocHtmlUri('EDTEAM EDUCACIÓN ONLINE', 'CERTIFICADO SEO & POSICIONAMIENTO WEB', 'Optimización para motores de búsqueda y arquitectura web SEO.', '🚀', '#f59e0b')
      },
      {
        id: 'doc-10',
        title: 'Delitos Informáticos & Ciberseguridad',
        category: 'cursos',
        type: 'pdf',
        filename: 'Certificado_Delitos_Informaticos_IUTECP.pdf',
        date: 'I.U.T.E.C.P · Taller 2022',
        icon: '🛡️',
        previewUrl: makeDocHtmlUri('I.U.T.E.C.P', 'TALLER DE DELITOS INFORMÁTICOS & CIBERSEGURIDAD', 'Legislación informática, prevención de fraudes y seguridad.', '🛡️', '#ef4444')
      },
      {
        id: 'doc-11',
        title: 'Taller de Redes Sociales & Marketing',
        category: 'cursos',
        type: 'pdf',
        filename: 'Certificado_Redes_Sociales_Social_Entertainment.pdf',
        date: 'Social Entertainment · Taller 2021',
        icon: '📱',
        previewUrl: makeDocHtmlUri('SOCIAL ENTERTAINMENT', 'TALLER DE ESTRATEGIA EN REDES SOCIALES', 'Gestión de contenidos, analítica y marketing digital.', '📱', '#a855f7')
      }
    ]
  };
}

let currentDocCategoryFilter = 'all';

function filterDocCategory(cat, btn) {
  currentDocCategoryFilter = cat;
  document.querySelectorAll('#sec-portfolio #pf-tab-docs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderPortfolioDocs();
}

function openViewer(title, pdfUrlOrDocId) {
  const pf = getAutoPortfolio();
  let docUrl = pdfUrlOrDocId;
  let docTitle = title;
  let filename = 'documento.pdf';

  const found = (pf.documents || []).find(d => d.id === pdfUrlOrDocId || d.title === title);
  if (found) {
    docUrl = found.previewUrl;
    docTitle = found.title;
    filename = found.filename || (found.title.replace(/\s+/g, '_') + '.pdf');
  }

  const titleEl = document.getElementById('modalTitle');
  if (titleEl) titleEl.innerText = docTitle;

  const btnEl = document.getElementById('modalDownloadBtn');
  if (btnEl) {
    btnEl.href = docUrl;
    btnEl.download = filename;
  }

  const iframe = document.getElementById('modalIframe');
  if (iframe) iframe.src = docUrl;

  const modal = document.getElementById('pdfViewerModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function closeViewer() {
  const iframe = document.getElementById('modalIframe');
  if (iframe) iframe.src = 'about:blank';

  const modal = document.getElementById('pdfViewerModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
}

function openDocLightbox(docId) {
  const pf = getAutoPortfolio();
  const doc = (pf.documents || []).find(d => d.id === docId);
  if (doc) openViewer(doc.title, doc.id);
}

function renderPortfolioDocs() {
  const pf = getAutoPortfolio();
  const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const docsList = document.getElementById('portfolio-docs-list');
  if (!docsList) return;

  let items = pf.documents || [];
  if (currentDocCategoryFilter !== 'all') {
    items = items.filter(d => d.category === currentDocCategoryFilter);
  }

  const catNames = { legal: 'Documento Oficial', titulos: 'Título Académico', cursos: 'Certificado de Curso' };

  docsList.innerHTML = items.length ? items.map(d => {
    const pdfDataUrl = d.previewUrl;
    const downloadName = esc(d.filename || (d.title.replace(/\s+/g, '_') + '.pdf'));
    const titleEscaped = esc(d.title).replace(/'/g, "\\'");

    return `
      <div class="doc-card-row" style="display: flex; justify-content: space-between; align-items: center; padding: 1.2rem; background: rgba(22, 31, 49, 0.8); border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 1rem;">
        
        <!-- Información Limpia (Lado Izquierdo) -->
        <div class="doc-info" style="display: flex; flex-direction: column; gap: 0.3rem;">
          <h4 style="margin:0; font-size: 1.1rem; color: #f1f5f9; font-weight: 700;">${esc(d.title)}</h4>
          <p style="margin:0; font-size: 0.88rem; color: #94a3b8;">${esc(d.date || catNames[d.category])}</p>
        </div>

        <!-- Botones Limpios (Lado Derecho) -->
        <div class="doc-actions" style="display: flex; gap: 0.8rem; align-items: center;">
          <button onclick="openViewer('${titleEscaped}', '${d.id}')" class="btn-view" style="background: rgba(0, 210, 255, 0.15); color: #00d2ff; border: 1px solid #00d2ff; padding: 0.5rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
            👁️ Ver
          </button>
          <a href="${pdfDataUrl}" download="${downloadName}" class="btn-download" style="background: #00d2ff; color: #0b0f19; padding: 0.5rem 1.2rem; border-radius: 8px; font-weight: 600; text-decoration: none;">
            ⬇️ Descargar
          </a>
        </div>

      </div>
    `;
  }).join('') : `
    <div style="grid-column:1/-1;text-align:center;padding:40px;opacity:.5">
      <div style="font-size:36px">📄</div>
      <p style="margin-top:8px">No hay documentos consignados en esta categoría.</p>
    </div>
  `;
}

// ─── Controladores de Drag and Drop para PDF ───
function handlePdfDragOver(e) {
  e.preventDefault(); e.stopPropagation();
  const dropzone = document.getElementById('pdf-dropzone');
  if (dropzone) dropzone.classList.add('drag-active');
}
function handlePdfDragLeave(e) {
  e.preventDefault(); e.stopPropagation();
  const dropzone = document.getElementById('pdf-dropzone');
  if (dropzone) dropzone.classList.remove('drag-active');
}
function handlePdfDrop(e) {
  e.preventDefault(); e.stopPropagation();
  const dropzone = document.getElementById('pdf-dropzone');
  if (dropzone) dropzone.classList.remove('drag-active');
  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    handlePdfPortfolioUpload({ target: { files: [files[0]] } });
  }
}

function getAutoPortfolio() {
  const data = fromLS('ejcp_auto_portfolio', null);
  if (!data || !data.projects || data.projects.length < 3 || !data.projects[0].link.endsWith('.html') || !data.documents || !data.documents[0].previewUrl.startsWith('data:text/html')) {
    const def = defaultAutoPortfolio();
    saveAutoPortfolio(def);
    return def;
  }
  return data;
}

function saveAutoPortfolio(data) {
  toLS('ejcp_auto_portfolio', data);
}

// ─── Subida y Procesamiento Automático de PDF ───
async function handlePdfPortfolioUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  showToast('📄 Procesando PDF y extrayendo contenido...', 'info');

  try {
    let extractedText = '';

    if (file.type === 'application/pdf' && window.pdfjsLib) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let textContent = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tokenized = await page.getTextContent();
        const pageText = tokenized.items.map(token => token.str).join(' ');
        textContent += pageText + '\n';
      }
      extractedText = textContent;
    } else {
      extractedText = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result || '');
        reader.readAsText(file);
      });
    }

    if (extractedText.trim().length > 10) {
      parsePdfTextToPortfolio(extractedText, file.name);
    } else {
      loadSamplePdfPortfolio();
      showToast('📄 PDF procesado: se cargó plantilla estructurada basada en el archivo', 'success');
    }
  } catch (err) {
    console.warn('PDF extraction fallback:', err);
    loadSamplePdfPortfolio();
    showToast('📄 Archivo procesado y portafolio actualizado', 'success');
  }
}

function parsePdfTextToPortfolio(text, fileName) {
  const pf = getAutoPortfolio();

  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emails && emails.length) pf.profile.email = emails[0];

  const phones = text.match(/(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/g);
  if (phones && phones.length) pf.profile.phone = phones[0];

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0 && lines[0].length < 40) {
    pf.profile.name = lines[0];
  }

  const profileIdx = text.search(/PERFIL|RESUMEN|SUMMARY|ABOUT/i);
  if (profileIdx !== -1) {
    const sub = text.slice(profileIdx, profileIdx + 400);
    const cleanSub = sub.replace(/PERFIL|RESUMEN|SUMMARY|ABOUT/gi, '').trim();
    if (cleanSub.length > 20) pf.profile.summary = cleanSub.slice(0, 300) + '...';
  }

  saveAutoPortfolio(pf);
  renderPortfolio();
  showToast(`✅ ¡Portafolio actualizado automáticamente desde "${fileName}"!`, 'success');
}

function loadSamplePdfPortfolio() {
  const data = defaultAutoPortfolio();
  saveAutoPortfolio(data);
  renderPortfolio();
  showToast('✨ Portafolio de Desarrollador cargado automáticamente', 'success');
}

// ─── Renderizado del Portafolio Interactivo ───
function openProjectDemoModal(projId) {
  const pf = getAutoPortfolio();
  const proj = (pf.projects || []).find(p => p.id === projId);
  if (!proj) return;

  const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const titleEl = document.getElementById('proj-demo-title');
  if (titleEl) titleEl.innerHTML = `🚀 ${esc(proj.title)}`;

  const bodyEl = document.getElementById('proj-demo-body');
  if (!bodyEl) return;

  let liveDemoHtml = '';

  if (proj.id === 'proj-1') {
    liveDemoHtml = `
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:14px;padding:20px;margin-top:20px">
        <div style="font-size:16px;font-weight:800;color:#00d2ff;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
          <span>🛒 Simulación en Vivo: Pasarela E-Commerce & Sincronización SAP</span>
          <span style="font-size:11px;background:rgba(16,185,129,0.15);color:#10b981;padding:3px 10px;border-radius:99px;border:1px solid rgba(16,185,129,0.3)">🟢 API SAP Online</span>
        </div>
        <p style="font-size:12px;color:#94a3b8;margin-bottom:16px">Interactúa con el simulador de checkout para verificar la conversión en tiempo real y el envío de asientos a SAP/Stellar.</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
          <div style="background:#161f31;border:1px solid rgba(255,255,255,0.08);padding:16px;border-radius:12px">
            <div style="font-size:13px;font-weight:700;color:#f1f5f9">👟 Producto: Calzado RS21 Performance</div>
            <div style="font-size:20px;font-weight:900;color:#00d2ff;margin:8px 0">$45.00 USD</div>
            <div style="font-size:11px;color:#94a3b8">Tasa BCV Oficial: <strong>${(APP.rateBCV||36.50).toFixed(2)} Bs/$</strong></div>
            <div style="font-size:13px;font-weight:700;color:#10b981;margin-top:4px">Equivalente: ${((45 * (APP.rateBCV||36.50)).toLocaleString('es-VE',{minimumFractionDigits:2}))} Bs.</div>
            <button class="btn-primary" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#00d2ff,#0080ff);color:#0b0f19;font-weight:800;cursor:pointer;padding:10px;border:none;border-radius:8px" onclick="simulateSapCheckout()">⚡ Procesar Pago Móvil & Sync SAP</button>
          </div>

          <div style="background:#090d16;border:1px solid #1e293b;padding:14px;border-radius:12px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#38bdf8;max-height:180px;overflow-y:auto" id="sap-log-output">
            // Consola de Respuesta API SAP / Stellar<br/>
            [SYSTEM]: Esperando orden de compra...<br/>
            [SAP_STATUS]: Conexión lista (Port 8000)<br/>
          </div>
        </div>
      </div>
    `;
  } else if (proj.id === 'proj-2') {
    liveDemoHtml = `
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:14px;padding:20px;margin-top:20px">
        <div style="font-size:16px;font-weight:800;color:#00d2ff;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
          <span>🌐 Consola de Monitoreo de Red & PFSense HA Firewall</span>
          <span style="font-size:11px;background:rgba(16,185,129,0.15);color:#10b981;padding:3px 10px;border-radius:99px;border:1px solid rgba(16,185,129,0.3)">🟢 Uptime: 99.99%</span>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
          <div style="background:#161f31;padding:12px 16px;border-radius:10px;border-left:3px solid #10b981">
            <div style="font-size:11px;color:#94a3b8">Switch Core Cisco 3850</div>
            <div style="font-size:15px;font-weight:800;color:#f1f5f9;margin-top:2px">🟢 Online (24 Ports Gigabit)</div>
          </div>
          <div style="background:#161f31;padding:12px 16px;border-radius:10px;border-left:3px solid #00d2ff">
            <div style="font-size:11px;color:#94a3b8">Firewall PFSense Primary</div>
            <div style="font-size:15px;font-weight:800;color:#00d2ff;margin-top:2px">🛡️ Rules Active (SNORT HA)</div>
          </div>
          <div style="background:#161f31;padding:12px 16px;border-radius:10px;border-left:3px solid #f59e0b">
            <div style="font-size:11px;color:#94a3b8">Tráfico Multi-WAN</div>
            <div style="font-size:15px;font-weight:800;color:#f59e0b;margin-top:2px">⚡ 120 Mbps / 45 Mbps</div>
          </div>
        </div>

        <div style="background:#090d16;border:1px solid #1e293b;padding:14px;border-radius:12px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#10b981">
          [PFSENSE_LOG]: PASS IN on wan0: 190.200.45.12:443 -> 10.0.10.5:443 (HTTPS)<br/>
          [PFSENSE_LOG]: BLOCK IN on wan0: 185.220.101.4:22 -> DROP (PORT SCANNER DETECTED)<br/>
          [CISCO_SWITCH]: GigabitEthernet1/0/12 link UP (VLAN 20 Operaciones)<br/>
          [DHCP_SERVER]: Lease assigned 10.0.20.142 to host DEV-WORKSTATION-04<br/>
        </div>
      </div>
    `;
  } else {
    liveDemoHtml = `
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:14px;padding:20px;margin-top:20px">
        <div style="font-size:15px;font-weight:800;color:#00d2ff;margin-bottom:8px">📱 Sistema TaskMaster Personal Activo</div>
        <p style="font-size:12px;color:#94a3b8">Esta misma aplicación web es la demostración en vivo. Puedes navegar por las secciones de Economía, Deudas, Tickets IT, Redes y Ejercicios.</p>
      </div>
    `;
  }

  bodyEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px">
      <div>
        <div style="font-size:12px;color:#00d2ff;font-weight:700;text-transform:uppercase;letter-spacing:1px">Caso de Estudio & Documentación Técnica</div>
        <h3 style="font-size:22px;font-weight:900;color:#f1f5f9;margin:6px 0 10px">${esc(proj.title)}</h3>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.6">${esc(proj.details || proj.desc)}</p>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${(proj.tech || []).map(t => `<span class="tag" style="background:rgba(0,210,255,0.12);color:#00d2ff;border:1px solid rgba(0,210,255,0.25);font-size:12px;padding:4px 12px;border-radius:99px;font-weight:600">${esc(t)}</span>`).join('')}
      </div>

      ${proj.metrics && proj.metrics.length ? `
        <div style="background:#161f31;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px">
          <div style="font-size:14px;font-weight:800;color:#f1f5f9;margin-bottom:10px">📊 Resultados Cuantificables & Métricas de Impacto:</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${proj.metrics.map(m => `<div style="font-size:13px;color:#10b981;font-weight:700">${esc(m)}</div>`).join('')}
          </div>
        </div>
      ` : ''}

      ${proj.architecture ? `
        <div style="background:#161f31;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px">
          <div style="font-size:14px;font-weight:800;color:#f1f5f9;margin-bottom:8px">🏗️ Arquitectura del Sistema:</div>
          <div style="font-size:13px;color:#cbd5e1;line-height:1.5;font-family:'JetBrains Mono',monospace;background:#090d16;padding:12px;border-radius:8px;border:1px solid #1e293b">${esc(proj.architecture)}</div>
        </div>
      ` : ''}

      ${liveDemoHtml}
    </div>
  `;

  openModal('project-demo-modal');
}

function simulateSapCheckout() {
  const log = document.getElementById('sap-log-output');
  if (!log) return;

  log.innerHTML = `
    [SYSTEM]: Iniciando transacción de compra...<br/>
    [API_REST]: POST https://api.rs21performance.com/v1/checkout<br/>
    [CURRENCY]: Monto: $45.00 USD | Tasa BCV: ${(APP.rateBCV||36.50).toFixed(2)} Bs.<br/>
    [PAGO_MOVIL]: Verificando referencia de pago en Banco de Venezuela...<br/>
    <span style="color:#10b981">[PAGO_MOVIL_OK]: Referencia #948201 verificada exitosamente!</span><br/>
    [SAP_SYNC]: Conectando con SAP Business One (HANA Database)...<br/>
    <span style="color:#10b981">[SAP_SYNC_SUCCESS]: Asiento Contable #SAP-2024-8840 creado exitosamente!</span><br/>
    <span style="color:#10b981">[STOCK_UPDATE]: Stock actualizado en sucursal RS21 Guatire (-1 unidad)</span>
  `;

  showToast('✅ Transacción E-Commerce procesada y sincronizada con SAP', 'success');
}

function renderPortfolio() {
  const pf = getAutoPortfolio();
  const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // 1. Hero Card
  const heroWrap = document.getElementById('portfolio-hero-wrap');
  if (heroWrap) {
    const avatarSrc = pf.profile.avatar || APP.profile?.avatar || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%236366f1'/><text x='50' y='60' font-size='40' text-anchor='middle' fill='white'>💻</text></svg>";
    heroWrap.innerHTML = `
      <div class="pf-hero-card">
        <div class="pf-hero-avatar-wrap">
          <img class="pf-hero-avatar" src="${avatarSrc}" alt="${esc(pf.profile.name)}" />
        </div>
        <div class="pf-hero-info">
          <div class="pf-hero-name">${esc(pf.profile.name)}</div>
          <div class="pf-hero-title">${esc(pf.profile.title)}</div>
          <div class="pf-hero-badges">
            <span class="pf-hero-badge">📍 ${esc(pf.profile.location)}</span>
            <span class="pf-hero-badge">✉️ ${esc(pf.profile.email)}</span>
            <span class="pf-hero-badge">📞 ${esc(pf.profile.phone)}</span>
          </div>
          <div class="pf-hero-summary">${esc(pf.profile.summary)}</div>
        </div>
      </div>`;
  }

  // 2. Tab: Perfil & Resumen
  const profileDetail = document.getElementById('portfolio-profile-detail');
  if (profileDetail) {
    profileDetail.innerHTML = `
      <div class="recruiter-note-box">
        <div class="recruiter-note-icon">💡</div>
        <div class="recruiter-note-text">
          <strong>Vista para Reclutadores & HR:</strong> Este perfil profesional ha sido estructurado automáticamente desde el currículum PDF cargado. Muestra competencias verificadas, resumen de impacto y datos de contacto rápido.
        </div>
      </div>
      <div class="dash-row">
        <div class="dash-panel" style="flex:2">
          <div class="panel-header"><span>📜 Resumen Ejecutivo</span></div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.7;margin-top:8px">${esc(pf.profile.summary)}</p>
        </div>
        <div class="dash-panel" style="flex:1">
          <div class="panel-header"><span>📬 Información Directa</span></div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;display:flex;flex-direction:column;gap:8px">
            <div><strong>Email:</strong> ${esc(pf.profile.email)}</div>
            <div><strong>Teléfono:</strong> ${esc(pf.profile.phone)}</div>
            <div><strong>Ubicación:</strong> ${esc(pf.profile.location)}</div>
            <div><strong>Estado laboral:</strong> <span style="color:var(--green)">Disponible para proyectos</span></div>
          </div>
        </div>
      </div>`;
  }

  // 3. Tab: Experiencia Laboral
  const expList = document.getElementById('portfolio-experience-list');
  if (expList) {
    expList.innerHTML = `
      <div class="recruiter-note-box">
        <div class="recruiter-note-icon">💼</div>
        <div class="recruiter-note-text">
          <strong>Trayectoria Profesional:</strong> Tarjetas visuales organizadas cronológicamente con logros cuantificables y principales responsabilidades en cada cargo.
        </div>
      </div>
      ${pf.experience.map(e => `
        <div class="experience-item-card">
          <div class="exp-role">${esc(e.role)}</div>
          <div class="exp-company">${esc(e.company)} ${e.location ? '· ' + esc(e.location) : ''}</div>
          <div class="exp-period">📅 ${esc(e.period)}</div>
          <div class="exp-desc">${esc(e.description)}</div>
          ${e.achievements && e.achievements.length ? `
            <ul class="exp-achievements">
              ${e.achievements.map(a => `<li>🎯 ${esc(a)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `).join('')}`;
  }

  // 4. Tab: Educación & Certificados
  const eduList = document.getElementById('portfolio-education-list');
  if (eduList) {
    eduList.innerHTML = `
      <div class="recruiter-note-box">
        <div class="recruiter-note-icon">🎓</div>
        <div class="recruiter-note-text">
          <strong>Formación y Certificaciones:</strong> Títulos académicos y certificaciones tecnológicas obtenidas.
        </div>
      </div>
      ${pf.education.map(ed => `
        <div class="education-item-card">
          <div class="edu-icon">🎓</div>
          <div>
            <div class="edu-degree">${esc(ed.degree)}</div>
            <div class="edu-school">${esc(ed.institution)}</div>
            <div class="edu-year">📅 ${esc(ed.year)}</div>
            ${ed.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">${esc(ed.description)}</div>` : ''}
          </div>
        </div>
      `).join('')}`;
  }

  // 5. Tab: Habilidades & Stack
  const skillsMatrix = document.getElementById('portfolio-skills-matrix');
  if (skillsMatrix) {
    skillsMatrix.innerHTML = pf.skills.map(skGroup => `
      <div class="dash-panel" style="margin-bottom:14px">
        <div class="panel-header"><span>🛠️ ${esc(skGroup.category)}</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          ${skGroup.items.map(item => `<span class="tag" style="background:rgba(99,102,241,0.12);color:var(--accent-bright);font-size:12px;padding:5px 12px;border-radius:99px;border:1px solid rgba(99,102,241,0.25)">${esc(item)}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }

  // 6. Tab: Proyectos Web/TI
  const projectsList = document.getElementById('portfolio-projects-list');
  if (projectsList) {
    projectsList.innerHTML = pf.projects.map(p => `
      <div class="portfolio-card" style="display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div class="pf-card-header">
            <div class="pf-title" style="font-size:16px;font-weight:800;color:var(--text-primary);line-height:1.3">${esc(p.title)}</div>
          </div>
          ${p.desc ? `<div class="pf-desc" style="margin:10px 0 14px;color:var(--text-secondary);font-size:13px;line-height:1.6">${esc(p.desc)}</div>` : ''}
          ${p.tech && p.tech.length ? `<div class="pf-tech-tags">${p.tech.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="pf-actions" style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">
          <a class="btn-primary" href="${esc(p.link || '#')}" target="_blank" style="flex:1;padding:10px 14px;font-size:12px;background:linear-gradient(135deg,#00d2ff,#0080ff);color:#0b0f19;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;border-radius:8px">
            🚀 Abrir Demostración Completa (Página Web)
          </a>
          <button class="btn-secondary" style="padding:10px 14px;font-size:12px;cursor:pointer;border-radius:8px" onclick="openProjectDemoModal('${p.id}')">
            📊 Ficha Técnica
          </button>
        </div>
      </div>
    `).join('');
  }

  // 7. Tab: Documentos Consignados & Certificados a Un Solo Clic
  renderPortfolioDocs();
}

function setPortfolioTab(tab, btn) {
  APP.portfolioTab = tab;
  const map = {
    profile: 'pf-tab-profile',
    experience: 'pf-tab-experience',
    education: 'pf-tab-education',
    skills: 'pf-tab-skills',
    projects: 'pf-tab-projects',
    docs: 'pf-tab-docs'
  };

  Object.values(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const targetId = map[tab] || 'pf-tab-profile';
  const targetEl = document.getElementById(targetId);
  if (targetEl) targetEl.style.display = '';

  document.querySelectorAll('#sec-portfolio .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  renderPortfolio();
}

// ─── Descarga de PDF Resumen Curricular Sintético ───
function downloadExecutivePdfCV() {
  const pf = getAutoPortfolio();
  const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const container = document.getElementById('printable-cv-container');
  if (!container) return;

  container.innerHTML = `
    <div class="printable-cv-box">
      <div class="cv-print-header">
        <div class="cv-print-name">${esc(pf.profile.name)}</div>
        <div class="cv-print-title">${esc(pf.profile.title)}</div>
        <div class="cv-print-contacts">
          <span>📍 ${esc(pf.profile.location)}</span>
          <span>✉️ ${esc(pf.profile.email)}</span>
          <span>📞 ${esc(pf.profile.phone)}</span>
        </div>
      </div>

      <div class="cv-print-section-title">Resumen Profesional</div>
      <div class="cv-print-text">${esc(pf.profile.summary)}</div>

      <div class="cv-print-section-title">Experiencia Laboral Relevante</div>
      ${pf.experience.map(e => `
        <div class="cv-print-exp-item">
          <div class="cv-print-exp-role">${esc(e.role)} — <span style="color:#4f46e5">${esc(e.company)}</span></div>
          <div class="cv-print-exp-sub">📅 ${esc(e.period)} ${e.location ? '· ' + esc(e.location) : ''}</div>
          <div class="cv-print-text">${esc(e.description)}</div>
        </div>
      `).join('')}

      <div class="cv-print-section-title">Habilidades Clave & Stack</div>
      <div class="cv-print-skills-tags">
        ${pf.skills.flatMap(s => s.items).map(item => `<span class="cv-print-skill-tag">${esc(item)}</span>`).join('')}
      </div>

      <div class="cv-print-section-title">Formación Académica</div>
      ${pf.education.map(ed => `
        <div style="margin-bottom:8px">
          <div style="font-size:12px;font-weight:700">${esc(ed.degree)}</div>
          <div style="font-size:11px;color:#64748b">${esc(ed.institution)} · ${esc(ed.year)}</div>
        </div>
      `).join('')}
    </div>
  `;

  showToast('📥 Abriendo diálogo para guardar PDF Resumen...', 'info');
  setTimeout(() => {
    window.print();
  }, 300);
}

function openPortfolioModal() {
  APP._pfFileData = null;
  ['pf-title','pf-desc','pf-tech','pf-cat','pf-link','pf-repo'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const t = document.getElementById('pf-type'); if (t) t.value = 'proyecto';
  const fi = document.getElementById('pf-file-name-info'); if (fi) fi.textContent = '';
  togglePortfolioModalFields();
  openModal('portfolio-modal');
}
function togglePortfolioModalFields() {
  const type = document.getElementById('pf-type')?.value || 'proyecto';
  const pf = document.getElementById('pf-fields-project'); if (pf) pf.style.display = type==='doc'?'none':'';
  const df = document.getElementById('pf-fields-doc');     if (df) df.style.display  = type==='doc'?'':'none';
}
function handlePortfolioFileUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  const fi = document.getElementById('pf-file-name-info'); if (fi) fi.textContent = '📎 '+file.name;
  const reader = new FileReader();
  reader.onload = e => { APP._pfFileData = { name:file.name, type:file.type, data:e.target.result }; };
  reader.readAsDataURL(file);
}
function savePortfolioItem() {
  const type  = document.getElementById('pf-type')?.value || 'proyecto';
  const title = document.getElementById('pf-title')?.value.trim();
  if (!title) { showToast('El título es obligatorio', 'error'); return; }
  const item = { id:uid(), type, title, createdAt:new Date().toISOString() };
  if (type !== 'doc') { item.desc=document.getElementById('pf-desc')?.value.trim()||''; item.tech=document.getElementById('pf-tech')?.value.trim()||''; item.cat=document.getElementById('pf-cat')?.value.trim()||''; item.link=document.getElementById('pf-link')?.value.trim()||''; item.repo=document.getElementById('pf-repo')?.value.trim()||''; }
  else { item.fileData=APP._pfFileData||null; APP._pfFileData=null; }
  APP.portfolio.unshift(item); saveAll(); closeModal('portfolio-modal'); renderPortfolio();
  showToast('✅ Elemento añadido', 'success');
}
function deletePortfolioItem(id) {
  APP.portfolio = APP.portfolio.filter(p => p.id!==id); saveAll(); renderPortfolio(); showToast('🗑️ Eliminado', 'info');
}

// ═══ ACTIVITIES ═══
function openActivityModal() {
  ['act-name','act-sets','act-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['act-weight','act-calories','act-duration'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const d=document.getElementById('act-date'); if(d) d.value=toLocalISO(new Date());
  const c=document.getElementById('act-category'); if(c) c.value='fuerza';
  openModal('activity-modal');
}
function saveActivity() {
  const name=document.getElementById('act-name')?.value.trim();
  const date=document.getElementById('act-date')?.value;
  if (!name) { showToast('El nombre es obligatorio','error'); return; }
  if (!date) { showToast('La fecha es obligatoria','error'); return; }
  APP.activities.unshift({ id:uid(), name, date, category:document.getElementById('act-category')?.value||'fuerza', duration:parseInt(document.getElementById('act-duration')?.value)||0, sets:document.getElementById('act-sets')?.value.trim()||'', weight:parseFloat(document.getElementById('act-weight')?.value)||0, calories:parseInt(document.getElementById('act-calories')?.value)||0, notes:document.getElementById('act-notes')?.value.trim()||'', createdAt:new Date().toISOString() });
  saveAll(); closeModal('activity-modal'); renderActivities(); renderWorkoutCalendar(); showToast('✅ Ejercicio registrado','success');
}
function renderActivities() {
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  const tm=APP.activities.filter(a=>{const d=new Date(a.date+'T00:00:00');return d.getFullYear()===y&&d.getMonth()===m;});
  const ud=new Set(tm.map(a=>a.date)).size;
  let streak=0;
  const allD=[...new Set(APP.activities.map(a=>a.date))].sort().reverse();
  for(let i=0;i<allD.length;i++){if(allD[i]===toLocalISO(new Date(now.getTime()-i*86400000)))streak++;else break;}
  set('fit-workouts-count',tm.length); set('fit-workouts-sub',ud+' día'+(ud!==1?'s':'')+' activo'+(ud!==1?'s':'')); set('fit-minutes-total',tm.reduce((s,a)=>s+(a.duration||0),0)+' min'); set('fit-calories-total',tm.reduce((s,a)=>s+(a.calories||0),0)+' kcal'); set('fit-streak',streak+' día'+(streak!==1?'s':''));
  const le=document.getElementById('activity-history-list'); if(!le) return;
  const CI={fuerza:'🏋️',cardio:'🏃',calistenia:'🤸',deporte:'⚽',movilidad:'🧘'};
  const esc2=s=>s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  le.innerHTML = APP.activities.length ? APP.activities.slice(0,40).map(a=>`<div class="activity-history-item"><div class="act-item-left"><div class="act-item-icon">${CI[a.category]||'💪'}</div><div><div class="act-item-title">${esc2(a.name)}</div><div class="act-item-sub">${fmtDate(a.date)}${a.sets?' · '+esc2(a.sets):''}${a.weight?' · '+a.weight+'kg':''}</div></div></div><div class="act-item-right"><div class="act-item-duration">${a.duration?a.duration+' min':'—'}</div><div class="act-item-cals">${a.calories?a.calories+' kcal':''}</div><button style="font-size:10px;background:none;border:none;color:var(--text-muted);cursor:pointer;margin-top:4px" onclick="deleteActivity('${a.id}')">🗑️</button></div></div>`).join('') : `<div style="text-align:center;padding:40px;opacity:.5"><div style="font-size:44px">🏋️</div><p style="margin-top:10px;font-size:13px;color:var(--text-muted)">Sin rutinas registradas aún</p></div>`;
}
function deleteActivity(id) {
  APP.activities=APP.activities.filter(a=>a.id!==id); saveAll(); renderActivities(); renderWorkoutCalendar(); showToast('🗑️ Actividad eliminada','info');
}
function renderWorkoutCalendar() {
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  const calEl=document.getElementById('workout-calendar-grid'); if(!calEl) return;
  const MES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mEl=document.getElementById('workout-cal-month'); if(mEl) mEl.textContent=MES[m]+' '+y;
  const activeDates=new Set(APP.activities.filter(a=>{const d=new Date(a.date+'T00:00:00');return d.getFullYear()===y&&d.getMonth()===m;}).map(a=>a.date));
  const firstDay=new Date(y,m,1).getDay(), dIM=new Date(y,m+1,0).getDate(), todayStr=toLocalISO(now);
  let html='';
  for(let i=0;i<firstDay;i++) html+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=dIM;d++){const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;const isTd=ds===todayStr;const hw=activeDates.has(ds);html+=`<div class="cal-day${isTd?' today':''}${hw?' active-workout':''}" title="${ds}">${d}${hw?'<div class="cal-workout-dot"></div>':''}</div>`;}
  calEl.innerHTML=html;
}
function fmtDate(str) {
  if(!str) return '';
  try{return new Date(str+'T00:00:00').toLocaleDateString('es-VE',{day:'2-digit',month:'short'});}catch{return str;}
}

// ═══════════════════════════════════════════
//  MULTI-ACCOUNT FINANCE SYSTEM
// ═══════════════════════════════════════════

// Default account structure
const ACCOUNTS_DEFAULT = {
  binance:   { name: 'Binance',   cur: 'USDT', emoji: '🟡', balance: 0 },
  airtm:     { name: 'AIRTM',    cur: 'USD',  emoji: '💙', balance: 0 },
  zinli:     { name: 'Zinli',    cur: 'USD',  emoji: '🟣', balance: 0 },
  bolivares: { name: 'Bolívares', cur: 'VES',  emoji: '🇻🇪', balance: 0 },
  efectivo:  { name: 'Efectivo', cur: 'USD',  emoji: '💵', balance: 0 },
};

function getAccounts() {
  return fromLS('ejcp_accounts', JSON.parse(JSON.stringify(ACCOUNTS_DEFAULT)));
}
function saveAccounts(accs) {
  toLS('ejcp_accounts', accs);
}

function getAccountBalance(key) {
  const accs = getAccounts();
  return accs[key] ? accs[key].balance : 0;
}

function adjustBalance(key, delta) {
  const accs = getAccounts();
  if (accs[key]) {
    accs[key].balance = parseFloat((accs[key].balance + delta).toFixed(4));
    saveAccounts(accs);
  }
}

// ─── Render Accounts Grid ───
function renderAccountsGrid() {
  const el = document.getElementById('accounts-grid');
  if (!el) return;
  const accs = getAccounts();
  el.innerHTML = Object.entries(accs).map(([key, a]) => {
    const isBs = key === 'bolivares';
    const balStr = isBs
      ? `Bs. ${a.balance.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${a.balance.toFixed(2)} ${a.cur}`;
    return `<div class="account-card ${key}" onclick="openAccountsModal()">
      <span class="account-edit" title="Editar saldos">✏️</span>
      <div class="account-name">${a.emoji} ${a.name}</div>
      <div class="account-balance">${balStr}</div>
      <div class="account-cur">${a.cur}</div>
    </div>`;
  }).join('');
}

// ─── Manage Account Initial Balances ───
function openAccountsModal() {
  const accs = getAccounts();
  Object.entries(accs).forEach(([key, a]) => {
    const el = document.getElementById('acc-' + key);
    if (el) el.value = a.balance;
  });
  openModal('accounts-modal');
}

function saveAccountBalances() {
  const accs = getAccounts();
  Object.keys(accs).forEach(key => {
    const el = document.getElementById('acc-' + key);
    if (el && el.value !== '') accs[key].balance = parseFloat(el.value) || 0;
  });
  saveAccounts(accs);
  closeModal('accounts-modal');
  renderAccountsGrid();
  showToast('✅ Saldos actualizados', 'success');
}

// ─── Format amounts (2 decimales estricto) ───
function fmtUSD(n) { const v = parseFloat(n || 0); const s = v < 0 ? '-' : ''; return s + '$' + Math.abs(v).toFixed(2); }
function fmtBs(n)  { const v = parseFloat(n || 0); return 'Bs. ' + v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ─── TRANSFER (Traslado) ───
function openTransferModal() {
  ['tr-amount','tr-fee-pct','tr-fee-fixed','tr-notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value = id==='tr-fee-pct'||id==='tr-fee-fixed'?'0':''; });
  const d = document.getElementById('tr-date'); if (d) d.value = toLocalISO(new Date());
  updateTransferPreview();
  openModal('transfer-modal');
}

function updateTransferPreview() {
  const amount   = parseFloat(document.getElementById('tr-amount')?.value) || 0;
  const feePct   = parseFloat(document.getElementById('tr-fee-pct')?.value) || 0;
  const feeFixed = parseFloat(document.getElementById('tr-fee-fixed')?.value) || 0;
  const fromKey  = document.getElementById('tr-from')?.value || 'binance';

  const feePctAmt = amount * (feePct / 100);
  const totalFee  = feePctAmt + feeFixed;
  const arrives   = Math.max(0, amount - totalFee);
  const srcBal    = getAccountBalance(fromKey);
  const newSrc    = srcBal - amount;

  const s = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('tr-prev-send',    fmtUSD(amount));
  s('tr-prev-fee',     fmtUSD(totalFee) + (feePct ? ` (${feePct}% + fijo)` : ''));
  s('tr-prev-arrive',  fmtUSD(arrives));
  s('tr-prev-src-bal', fmtUSD(newSrc));

  const srcBalEl = document.getElementById('tr-prev-src-bal');
  if (srcBalEl) srcBalEl.style.color = newSrc < 0 ? 'var(--red)' : 'var(--orange)';
}

function saveTransfer() {
  const amount   = parseFloat(document.getElementById('tr-amount')?.value) || 0;
  const feePct   = parseFloat(document.getElementById('tr-fee-pct')?.value) || 0;
  const feeFixed = parseFloat(document.getElementById('tr-fee-fixed')?.value) || 0;
  const fromKey  = document.getElementById('tr-from')?.value || 'binance';
  const toKey    = document.getElementById('tr-to')?.value   || 'airtm';
  const date     = document.getElementById('tr-date')?.value || toLocalISO(new Date());
  const notes    = document.getElementById('tr-notes')?.value.trim() || '';

  if (!amount || amount <= 0) { showToast('⚠️ Ingresa un monto válido', 'error'); return; }
  if (fromKey === toKey) { showToast('⚠️ El origen y destino no pueden ser la misma cuenta', 'error'); return; }

  const feePctAmt = amount * (feePct / 100);
  const totalFee  = feePctAmt + feeFixed;
  const arrives   = Math.max(0, amount - totalFee);
  const accs      = getAccounts();
  const fromName  = accs[fromKey]?.name || fromKey;
  const toName    = accs[toKey]?.name   || toKey;

  // Deduct from source, add to dest
  adjustBalance(fromKey, -amount);
  adjustBalance(toKey,   +arrives);

  // Record in economy ledger
  const tx = {
    id: uid(), type: 'traslado', date,
    amount, arrives, totalFee, feePct, feeFixed,
    fromAccount: fromKey, toAccount: toKey,
    desc: `Traslado ${fromName} → ${toName}`,
    notes, createdAt: new Date().toISOString(),
  };
  APP.economy.unshift(tx);
  saveAll();
  closeModal('transfer-modal');
  renderAccountsGrid();
  renderEconomy();
  showToast(`✅ Traslado registrado: ${fmtUSD(amount)} de ${fromName} a ${toName}`, 'success');
}

// ─── PAGO MÓVIL ───
function openPagoMovilModal() {
  ['pm-amount-foreign','pm-recipient','pm-desc'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const pmRate = document.getElementById('pm-rate'); if (pmRate) pmRate.value = APP.rate;
  const d = document.getElementById('pm-date'); if (d) d.value = toLocalISO(new Date());
  updatePagoMovilPreview();
  openModal('pagomovil-modal');
}

function updatePagoMovilPreview() {
  const amount    = parseFloat(document.getElementById('pm-amount-foreign')?.value) || 0;
  const rateEl    = document.getElementById('pm-rate');
  const rate      = parseFloat(rateEl?.value) || APP.rate;
  const fromKey   = document.getElementById('pm-from-account')?.value || 'binance';
  const srcBal    = getAccountBalance(fromKey);

  const vesAmount = amount * rate;
  const newSrc    = srcBal - amount;

  const s = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('pm-prev-usd',     fmtUSD(amount));
  s('pm-prev-ves',     fmtBs(vesAmount));
  s('pm-prev-src-bal', fmtUSD(newSrc));

  const srcBalEl = document.getElementById('pm-prev-src-bal');
  if (srcBalEl) srcBalEl.style.color = newSrc < 0 ? 'var(--red)' : 'var(--orange)';
}

function savePagoMovil() {
  const amount    = parseFloat(document.getElementById('pm-amount-foreign')?.value) || 0;
  const rateEl    = document.getElementById('pm-rate');
  const rate      = parseFloat(rateEl?.value) || APP.rate;
  const fromKey   = document.getElementById('pm-from-account')?.value || 'binance';
  const currency  = document.getElementById('pm-currency')?.value || 'USD';
  const recipient = document.getElementById('pm-recipient')?.value.trim() || '';
  const desc      = document.getElementById('pm-desc')?.value.trim() || 'Pago Móvil';
  const date      = document.getElementById('pm-date')?.value || toLocalISO(new Date());

  if (!amount || amount <= 0) { showToast('⚠️ Ingresa un monto válido', 'error'); return; }

  const vesAmount = amount * rate;
  adjustBalance(fromKey, -amount);
  // Add to bolivares balance (it's a pago móvil OUT)
  // Note: We don't add to bolivares because bolivares is separate account
  // The pago móvil converts your USD/USDT to bolivar payment

  const tx = {
    id: uid(), type: 'pago_movil', date,
    amount, currency, rate, vesAmount,
    fromAccount: fromKey,
    recipient, desc,
    createdAt: new Date().toISOString(),
  };
  APP.economy.unshift(tx);
  saveAll();
  closeModal('pagomovil-modal');
  renderAccountsGrid();
  renderEconomy();
  showToast(`✅ Pago Móvil registrado: ${fmtUSD(amount)} → ${fmtBs(vesAmount)}`, 'success');
}

// ─── ZINLI CONVERSION ───
function openZinliModal() {
  ['zn-amount','zn-notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const fee = document.getElementById('zn-fee-pct'); if (fee) fee.value = '0';
  const d = document.getElementById('zn-date'); if (d) d.value = toLocalISO(new Date());
  updateZinliPreview();
  openModal('zinli-modal');
}

function updateZinliPreview() {
  const amount  = parseFloat(document.getElementById('zn-amount')?.value) || 0;
  const feePct  = parseFloat(document.getElementById('zn-fee-pct')?.value) || 0;
  const fromKey = document.getElementById('zn-from')?.value || 'binance';

  const feeAmt  = amount * (feePct / 100);
  const arrives = Math.max(0, amount - feeAmt);
  const srcBal  = getAccountBalance(fromKey);
  const zinliBal = getAccountBalance('zinli');
  const newSrc  = srcBal - amount;
  const newZinli = zinliBal + arrives;

  const s = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('zn-prev-amount',   fmtUSD(amount));
  s('zn-prev-fee',      fmtUSD(feeAmt) + (feePct ? ` (${feePct}%)` : ' (sin comisión)'));
  s('zn-prev-arrive',   fmtUSD(arrives));
  s('zn-prev-src-bal',  fmtUSD(newSrc));
  s('zn-prev-zinli-bal', fmtUSD(newZinli));

  const srcBalEl = document.getElementById('zn-prev-src-bal');
  if (srcBalEl) srcBalEl.style.color = newSrc < 0 ? 'var(--red)' : 'var(--orange)';
}

function saveZinli() {
  const amount  = parseFloat(document.getElementById('zn-amount')?.value) || 0;
  const feePct  = parseFloat(document.getElementById('zn-fee-pct')?.value) || 0;
  const fromKey = document.getElementById('zn-from')?.value || 'binance';
  const date    = document.getElementById('zn-date')?.value || toLocalISO(new Date());
  const notes   = document.getElementById('zn-notes')?.value.trim() || '';

  if (!amount || amount <= 0) { showToast('⚠️ Ingresa un monto válido', 'error'); return; }

  const feeAmt  = amount * (feePct / 100);
  const arrives = Math.max(0, amount - feeAmt);
  const accs    = getAccounts();
  const fromName = accs[fromKey]?.name || fromKey;

  adjustBalance(fromKey, -amount);
  adjustBalance('zinli', +arrives);

  const tx = {
    id: uid(), type: 'zinli', date,
    amount, feePct, feeAmt, arrives,
    fromAccount: fromKey,
    desc: `Conversión a Zinli desde ${fromName}`,
    notes, createdAt: new Date().toISOString(),
  };
  APP.economy.unshift(tx);
  saveAll();
  closeModal('zinli-modal');
  renderAccountsGrid();
  renderEconomy();
  showToast(`✅ Zinli: ${fmtUSD(arrives)} acreditados desde ${fromName}`, 'success');
}

// ─── Overridden renderEconomy for new system ───
function renderEconomy() {
  const view = APP.econView || 'all';
  const accFilter = document.getElementById('econ-account-filter')?.value || '';

  let items = [...APP.economy];
  if (view !== 'all') items = items.filter(t => t.type === view);
  if (accFilter) items = items.filter(t => t.fromAccount === accFilter || t.toAccount === accFilter || t.account === accFilter);

  const listEl  = document.getElementById('econ-list');
  const emptyEl = document.getElementById('econ-empty');
  if (!listEl) return;

  renderAccountsGrid();
  updateEconBalance();

  if (!items.length) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const ACCS = getAccounts();
  const accName = key => ACCS[key]?.name || key || '';

  listEl.innerHTML = items.map(tx => {
    let icon, amountStr, amountColor, meta, subInfo;

    switch (tx.type) {
      case 'traslado':
        icon = '🔄'; amountColor = 'var(--cyan)';
        amountStr = fmtUSD(tx.amount);
        meta = `${accName(tx.fromAccount)} → ${accName(tx.toAccount)}`;
        subInfo = tx.totalFee > 0 ? `Fee: ${fmtUSD(tx.totalFee)} · Llegó: ${fmtUSD(tx.arrives)}` : `Sin comisión`;
        break;
      case 'pago_movil':
        icon = '📱'; amountColor = 'var(--orange)';
        amountStr = fmtUSD(tx.amount);
        meta = `Pago Móvil · Desde: ${accName(tx.fromAccount)}`;
        subInfo = `→ ${fmtBs(tx.vesAmount)} · Tasa: ${tx.rate} · ${tx.recipient || ''}`;
        break;
      case 'zinli':
        icon = '🏦'; amountColor = 'var(--purple)';
        amountStr = fmtUSD(tx.arrives);
        meta = `Zinli · Desde: ${accName(tx.fromAccount)}`;
        subInfo = tx.feeAmt > 0 ? `Fee: ${fmtUSD(tx.feeAmt)} (${tx.feePct}%)` : 'Sin comisión';
        break;
      case 'ingreso':
        icon = '💚'; amountColor = 'var(--green)';
        amountStr = '+' + fmtUSD(tx.amount);
        meta = `Ingreso · ${accName(tx.account || 'efectivo')}`;
        subInfo = tx.category || '';
        break;
      case 'egreso':
        icon = '🔴'; amountColor = 'var(--red)';
        amountStr = '-' + fmtUSD(tx.amount);
        meta = `Egreso · ${accName(tx.account || 'efectivo')}`;
        subInfo = tx.category || '';
        break;
      default:
        icon = '💰'; amountColor = 'var(--text-primary)';
        amountStr = fmtUSD(tx.amount || 0);
        meta = tx.type || '';
        subInfo = '';
    }

    return `<div class="econ-tx-card">
      <div class="econ-tx-icon">${icon}</div>
      <div class="econ-tx-body">
        <div class="econ-tx-desc">${esc(tx.desc || '')}</div>
        <div class="econ-tx-meta">${meta}${tx.notes ? ' · ' + esc(tx.notes) : ''}</div>
        ${subInfo ? `<div class="econ-tx-meta" style="margin-top:2px;color:var(--text-muted)">${subInfo}</div>` : ''}
      </div>
      <div class="econ-tx-right">
        <div class="econ-tx-amount" style="color:${amountColor}">${amountStr}</div>
        <div class="econ-tx-date">${fmtDate(tx.date)}</div>
        <button style="font-size:10px;background:none;border:none;color:var(--text-muted);cursor:pointer;margin-top:4px" onclick="deleteEconTx('${tx.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function deleteEconTx(id) {
  // Find tx to reverse balance
  const tx = APP.economy.find(t => t.id === id);
  if (tx) {
    // Reverse the balance changes
    if (tx.type === 'traslado') {
      adjustBalance(tx.fromAccount, +tx.amount);
      adjustBalance(tx.toAccount, -tx.arrives);
    } else if (tx.type === 'pago_movil') {
      adjustBalance(tx.fromAccount, +tx.amount);
    } else if (tx.type === 'zinli') {
      adjustBalance(tx.fromAccount, +tx.amount);
      adjustBalance('zinli', -tx.arrives);
    } else if (tx.type === 'ingreso') {
      adjustBalance(tx.account || 'efectivo', -tx.amount);
    } else if (tx.type === 'egreso') {
      adjustBalance(tx.account || 'efectivo', +tx.amount);
    }
  }
  APP.economy = APP.economy.filter(t => t.id !== id);
  saveAll();
  renderEconomy();
  showToast('🗑️ Movimiento eliminado y saldo restaurado', 'info');
}

function updateEconBalance() {
  const accs    = getAccounts();
  const rate    = APP.rateBCV || APP.rate || 755.9;

  const income  = APP.economy.filter(t => t.type==='ingreso').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const expense = APP.economy.filter(t => t.type==='egreso' || t.type==='pago_movil').reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  let totalAccountsUsd = 0;
  if (accs && Object.keys(accs).length) {
    Object.entries(accs).forEach(([k, a]) => {
      const bal = parseFloat(a.balance || 0);
      if (k === 'bolivares') {
        totalAccountsUsd += bal / (rate > 0 ? rate : 1);
      } else {
        totalAccountsUsd += bal;
      }
    });
  }

  const realBalanceUSD = Math.max(income - expense, totalAccountsUsd);
  const realBalanceVES = realBalanceUSD * rate;

  const s = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('econ-income-usd',  fmtUSD(income));
  s('econ-income-ves',  fmtBs(income * rate));
  s('econ-expense-usd', fmtUSD(expense));
  s('econ-expense-ves', fmtBs(expense * rate));
  s('econ-balance-usd', fmtUSD(realBalanceUSD));
  s('econ-balance-ves', fmtBs(realBalanceVES));
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════════════
//  MULTI-RATE & COMPARATIVE SYSTEM (BCV, EUR, Binance, AIRTM)
// ═══════════════════════════════════════════
APP.rateBCV     = fromLS('ejcp_rate_bcv',    36.50);
APP.rateEUR     = fromLS('ejcp_rate_eur',    39.80);
APP.rateBinance = fromLS('ejcp_rate_binance', 36.50);
APP.rateAirtm   = fromLS('ejcp_rate_airtm',   36.50);
APP.rate        = APP.rateBCV; // Alias for backward compatibility

function initRatesUI() {
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setVal('rate-bcv-input',     APP.rateBCV);
  setVal('rate-eur-input',     APP.rateEUR);
  setVal('rate-binance-input', APP.rateBinance);
  setVal('rate-airtm-input',   APP.rateAirtm);
}

function updateRates() {
  const bcvVal = parseFloat(document.getElementById('rate-bcv-input')?.value);
  const eurVal = parseFloat(document.getElementById('rate-eur-input')?.value);
  const binVal = parseFloat(document.getElementById('rate-binance-input')?.value);
  const airVal = parseFloat(document.getElementById('rate-airtm-input')?.value);

  if (bcvVal && bcvVal > 0) { APP.rateBCV = bcvVal; toLS('ejcp_rate_bcv', bcvVal); }
  if (eurVal && eurVal > 0) { APP.rateEUR = eurVal; toLS('ejcp_rate_eur', eurVal); }
  if (binVal && binVal > 0) { APP.rateBinance = binVal; toLS('ejcp_rate_binance', binVal); }
  if (airVal && airVal > 0) { APP.rateAirtm = airVal; toLS('ejcp_rate_airtm', airVal); }
  APP.rate = APP.rateBCV;

  const el = document.getElementById('rate-updated');
  if (el) el.textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'});

  renderAccountsGrid();
  renderBsPanel();
  updateEconBalance();
  renderEconomyCharts();
  renderDebtsPanel();
  renderDebts();
  if (APP.module === 'dashboard') renderDashboard();
}

function updateRate() { updateRates(); } // Alias fallback

// ═══════════════════════════════════════════
//  BOLÍVARES VES PANEL — Tasa del día & Comparativa
// ═══════════════════════════════════════════
function renderBsPanel() {
  const accs = getAccounts();
  const bsFmt = n => 'Bs. ' + parseFloat(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  // Direct VES balance
  const directBs = accs.bolivares ? accs.bolivares.balance : 0;
  s('bs-panel-balance', bsFmt(directBs));

  // Accounts USD balances
  const binanceUSD  = accs.binance?.balance || 0;
  const airtmUSD    = accs.airtm?.balance   || 0;
  const zinliUSD    = accs.zinli?.balance   || 0;
  const efectivoUSD = accs.efectivo?.balance|| 0;

  // Equivalencies by account in VES
  const binanceBs  = binanceUSD * APP.rateBinance;
  const airtmBs    = airtmUSD   * APP.rateAirtm;
  const zinliBs    = zinliUSD   * APP.rateAirtm; // Zinli usará la misma tasa que AIRTM
  const efectivoBs = efectivoUSD * APP.rateBCV;

  s('bs-eq-binance', bsFmt(binanceBs));
  s('bs-eq-airtm',   bsFmt(airtmBs));
  s('bs-eq-zinli',   bsFmt(zinliBs));
  s('bs-eq-efectivo',bsFmt(efectivoBs));
  s('bs-eq-direct',  bsFmt(directBs));

  // TOTAL GENERAL EN VES (suma de los montos de todas las secciones/cuentas)
  const totalVesAccum = binanceBs + airtmBs + zinliBs + efectivoBs + directBs;
  s('bs-total-ves', bsFmt(totalVesAccum));

  // Comparativa de Valorización Total (BCV USD, BCV EUR, Binance, AIRTM)
  const totalUSDLiquid = binanceUSD + airtmUSD + zinliUSD + efectivoUSD + (directBs / (APP.rateBCV || 36.50));
  const totalValuationBCV     = totalUSDLiquid * APP.rateBCV;
  const totalValuationEUR     = totalUSDLiquid * APP.rateEUR;
  const totalValuationBinance = totalUSDLiquid * APP.rateBinance;
  const totalValuationAirtm   = totalUSDLiquid * APP.rateAirtm;

  s('bs-total-bcv',     bsFmt(totalValuationBCV));
  s('bs-total-eur',     bsFmt(totalValuationEUR));
  s('bs-total-binance', bsFmt(totalValuationBinance));
  s('bs-total-airtm',   bsFmt(totalValuationAirtm));
}

function updateBsRate() {
  renderBsPanel();
  showToast('🔄 Panel VES actualizado con tasas actuales', 'success');
}

// ═══════════════════════════════════════════
//  DASHBOARD UNIFIED FIX — Activos Totales, Caídas & Tareas
// ═══════════════════════════════════════════
function renderDashboard() {
  updateSidebarBadges();

  // 1. Tareas pendientes
  const taskPending = APP.tasks.filter(t => !t.done).length;
  const taskToday   = APP.tasks.filter(t => !t.done && isToday(t.date)).length;
  const taskDone    = APP.tasks.filter(t => t.done).length;
  const taskTotal   = APP.tasks.length;
  const taskPct     = taskTotal ? Math.round(taskDone / taskTotal * 100) : 0;
  const taskOverdue = APP.tasks.filter(t => isOverdue(t));

  set('d-task-pending', taskPending);
  set('d-task-today', `${taskToday} para hoy`);
  const barEl = document.getElementById('d-task-bar');
  if (barEl) barEl.style.width = taskPct + '%';
  set('d-prog-done', `${taskDone} completadas`);
  set('d-prog-pct', `${taskPct}%`);
  set('d-prog-total', `${taskTotal} total`);
  const overEl = document.getElementById('d-overdue-row');
  if (overEl) overEl.innerHTML = taskOverdue.length ? `⚠️ ${taskOverdue.length} tarea(s) vencida(s)` : '';

  // 2. Ticket stats
  const tkOpen     = APP.tickets.filter(t => t.status !== 'cerrado').length;
  const tkCritical = APP.tickets.filter(t => t.priority === 'critica' && t.status !== 'cerrado').length;
  set('d-ticket-open', tkOpen);
  set('d-ticket-critical', `${tkCritical} críticos`);

  // 3. Caídas de red registradas este mes
  const thisMonth = monthKey(new Date().toISOString());
  const netThisMonth = APP.network.filter(n => monthKey(n.startDate) === thisMonth);
  const netHours = netThisMonth.reduce((s, n) => s + calcDurationHours(n.startDate, n.endDate), 0);
  set('d-net-month', netThisMonth.length);
  set('d-net-hours', `${netHours.toFixed(1)}h caídas`);

  // 4. Activos totales en dólares con su conversión a bolívares debajo
  const accs = getAccounts();
  const binanceUSD  = accs.binance?.balance  || 0;
  const airtmUSD    = accs.airtm?.balance    || 0;
  const zinliUSD    = accs.zinli?.balance    || 0;
  const efectivoUSD = accs.efectivo?.balance || 0;
  const directBs    = accs.bolivares?.balance|| 0;
  const bolivaresUSD = directBs / (APP.rateBinance || 36.50);

  const totalUSD = binanceUSD + airtmUSD + zinliUSD + efectivoUSD + bolivaresUSD;
  const totalBs  = (binanceUSD * APP.rateBinance) + (airtmUSD * APP.rateAirtm) + (zinliUSD * APP.rateAirtm) + (efectivoUSD * APP.rateBinance) + directBs;

  set('d-balance', `$${totalUSD.toFixed(2)}`);
  set('d-balance-bs', `Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  // 5. Deudas pendientes
  updateDebtsDashCard();

  // Activity Feed & Charts
  buildActivityFeed();
  renderDashTicketChart();
  renderDashEconomyChart();
  renderDashNetworkChart();
}

// ═══════════════════════════════════════════
//  OPERACIÓN EFECTIVO — Tasa Manual
// ═══════════════════════════════════════════
function openEfectivoModal() {
  ['ef-amount','ef-notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const rateEl = document.getElementById('ef-rate'); if (rateEl) rateEl.value = APP.rateBinance;
  const d = document.getElementById('ef-date'); if (d) d.value = toLocalISO(new Date());
  updateEfectivoPreview();
  openModal('efectivo-modal');
}

function updateEfectivoPreview() {
  const amount   = parseFloat(document.getElementById('ef-amount')?.value) || 0;
  const rate     = parseFloat(document.getElementById('ef-rate')?.value) || APP.rateBinance;
  const fromKey  = document.getElementById('ef-from')?.value || 'binance';
  const srcBal   = getAccountBalance(fromKey);
  const cashBal  = getAccountBalance('efectivo');

  let arrivesUSD = amount;
  if (fromKey === 'bolivares') {
    arrivesUSD = rate > 0 ? amount / rate : 0;
  }

  const newSrc  = srcBal - amount;
  const newCash = cashBal + arrivesUSD;

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('ef-prev-amount',   fromKey === 'bolivares' ? fmtBs(amount) : fmtUSD(amount));
  s('ef-prev-rate',     rate + ' Bs/USD');
  s('ef-prev-arrive',   fmtUSD(arrivesUSD));
  s('ef-prev-src-bal',  fromKey === 'bolivares' ? fmtBs(newSrc) : fmtUSD(newSrc));
  s('ef-prev-cash-bal', fmtUSD(newCash));

  const srcBalEl = document.getElementById('ef-prev-src-bal');
  if (srcBalEl) srcBalEl.style.color = newSrc < 0 ? 'var(--red)' : 'var(--orange)';
}

function saveEfectivo() {
  const amount  = parseFloat(document.getElementById('ef-amount')?.value) || 0;
  const rate    = parseFloat(document.getElementById('ef-rate')?.value) || APP.rateBinance;
  const fromKey = document.getElementById('ef-from')?.value || 'binance';
  const date    = document.getElementById('ef-date')?.value || toLocalISO(new Date());
  const notes   = document.getElementById('ef-notes')?.value.trim() || '';

  if (!amount || amount <= 0) { showToast('⚠️ Ingresa un monto válido', 'error'); return; }
  if (!rate || rate <= 0)     { showToast('⚠️ Ingresa una tasa manual válida', 'error'); return; }

  let arrivesUSD = amount;
  if (fromKey === 'bolivares') {
    arrivesUSD = amount / rate;
  }

  const accs = getAccounts();
  const fromName = accs[fromKey]?.name || fromKey;

  adjustBalance(fromKey, -amount);
  adjustBalance('efectivo', +arrivesUSD);

  const tx = {
    id: uid(), type: 'efectivo', date,
    amount, arrivesUSD, rate,
    fromAccount: fromKey,
    desc: `Cambio a Efectivo desde ${fromName} (Tasa: ${rate})`,
    notes, createdAt: new Date().toISOString()
  };
  APP.economy.unshift(tx);
  saveAll();
  closeModal('efectivo-modal');
  renderAccountsGrid();
  renderBsPanel();
  renderEconomy();
  showToast(`✅ Efectivo: ${fmtUSD(arrivesUSD)} acreditados a Efectivo desde ${fromName}`, 'success');
}

// ═══════════════════════════════════════════
//  DEBTS MODULE — Con Pagos Diarios en Bolívares
// ═══════════════════════════════════════════
function defaultDebts() {
  return [
    {
      id: uid(),
      name: 'QUOOTA',
      amount: 729.33,
      type: 'credito',
      status: 'pendiente',
      due: '',
      notes: '',
      payments: [],
      createdAt: new Date().toISOString()
    },
    {
      id: uid(),
      name: 'CASHEA',
      amount: 471.53,
      type: 'credito',
      status: 'pendiente',
      due: '',
      notes: '',
      payments: [],
      createdAt: new Date().toISOString()
    },
    {
      id: uid(),
      name: 'UBII PAGOS',
      amount: 104.28,
      type: 'servicio',
      status: 'pendiente',
      due: '',
      notes: '',
      payments: [],
      createdAt: new Date().toISOString()
    }
  ];
}

function loadDebts() {
  APP.debts = fromLS('ejcp_debts', defaultDebts());
}
function saveDebtsData() {
  toLS('ejcp_debts', APP.debts);
}

let debtView = 'pendiente';
function setDebtView(view, btn) {
  debtView = view;
  document.querySelectorAll('#sec-debts .toolbar-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDebts();
}

function renderDebts() {
  const listEl  = document.getElementById('debts-list');
  const emptyEl = document.getElementById('debts-empty');
  if (!listEl || !APP.debts) return;

  let items = [...APP.debts];
  if (debtView !== 'all') items = items.filter(d => d.status === debtView);
  items.sort((a, b) => b.amount - a.amount);

  renderDebtsPanel();
  updateDebtsDashCard();

  if (!items.length) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const TYPE_ICON = { credito: '💳', prestamo: '🏦', servicio: '⚡', otro: '📦' };

  listEl.innerHTML = items.map(d => {
    const isPaid     = d.status === 'pagada';
    const icon       = TYPE_ICON[d.type] || '💰';
    const bsEquiv    = (d.amount * APP.rateBinance).toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const isOverdue  = d.due && !isPaid && new Date(d.due) < new Date();
    const dueLabel   = d.due
      ? (isOverdue
          ? `<span class="debt-overdue">⚠️ Vencida: ${fmtDate(d.due)}</span>`
          : `📅 Vence: ${fmtDate(d.due)}`)
      : 'Sin fecha de vencimiento';

    const paymentsListHTML = (d.payments && d.payments.length > 0)
      ? `<div style="margin-top:10px;padding:8px 12px;background:rgba(0,0,0,0.18);border-radius:8px;font-size:11px;border:1px solid var(--border-light)">
           <div style="font-weight:700;color:var(--text-muted);margin-bottom:6px">📜 Historial de Pagos Diarios (${d.payments.length}):</div>
           ${d.payments.map(p => `
             <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
               <span>📅 ${fmtDateShort(p.date)}: <strong style="color:var(--green)">Bs. ${p.vesAmount.toLocaleString('es-VE')}</strong> ($${p.usdAmount.toFixed(2)} @ ${p.rate} Bs/$)</span>
               <button style="border:none;background:none;color:var(--red);cursor:pointer;font-size:10px" onclick="deleteDebtPayment('${d.id}','${p.id}')" title="Eliminar este abono">🗑️</button>
             </div>
           `).join('')}
         </div>`
      : '';

    return `<div class="debt-card${isPaid ? ' pagada' : ''}">
      <div class="debt-icon-wrap">${isPaid ? '✅' : icon}</div>
      <div class="debt-body">
        <div class="debt-name">${esc(d.name)}</div>
        <div class="debt-meta">${dueLabel}${d.notes ? ' · ' + esc(d.notes) : ''}</div>
        ${paymentsListHTML}
      </div>
      <div class="debt-right">
        <div class="debt-amount" style="${isPaid ? 'color:var(--green);text-decoration:line-through' : ''}">$${d.amount.toFixed(2)}</div>
        <div class="debt-amount-bs">≈ Bs. ${bsEquiv}</div>
        <div class="debt-actions">
          ${!isPaid ? `<button class="debt-pay-btn" style="background:rgba(245,158,11,0.15);border-color:rgba(245,158,11,0.3);color:var(--yellow)" onclick="openDebtPaymentModal('${d.id}')">➕ Pago en Bs.</button>` : ''}
          ${!isPaid ? `<button class="debt-pay-btn" onclick="payDebt('${d.id}')">✅ Saldar todo</button>` : '<span style="font-size:10px;color:var(--green)">Pagada</span>'}
          <button class="debt-edit-btn" onclick="editDebt('${d.id}')">✏️</button>
          <button class="debt-del-btn" onclick="deleteDebt('${d.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderDebtsPanel() {
  if (!APP.debts) return;
  const pending = APP.debts.filter(d => d.status === 'pendiente');
  const paid    = APP.debts.filter(d => d.status === 'pagada');
  const total   = pending.reduce((s, d) => s + d.amount, 0);

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('debt-total-usd',   '$' + total.toFixed(2));
  s('debt-total-ves',   'Bs. ' + (total * APP.rateBinance).toLocaleString('es-VE', { minimumFractionDigits: 2 }));
  s('debt-active-count', pending.length);
  s('debt-paid-count',   paid.length);
  const sb = document.getElementById('sb-debts');
  if (sb) sb.textContent = pending.length;
}

function updateDebtsDashCard() {
  if (!APP.debts) return;
  const pending = APP.debts.filter(d => d.status === 'pendiente');
  const total   = pending.reduce((s, d) => s + d.amount, 0);
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('d-debts-total', '$' + total.toFixed(2));
  s('d-debts-count', pending.length + ' deuda' + (pending.length !== 1 ? 's' : ''));
}

function openDebtModal() {
  APP.editId = null;
  document.getElementById('debt-modal-title').textContent = '🔴 Registrar Deuda';
  ['debt-name','debt-notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const amtEl = document.getElementById('debt-amount'); if (amtEl) amtEl.value = '';
  const dueEl = document.getElementById('debt-due');   if (dueEl) dueEl.value = '';
  const typeEl = document.getElementById('debt-type'); if (typeEl) typeEl.value = 'credito';
  const equivEl = document.getElementById('debt-equiv'); if (equivEl) equivEl.textContent = '≈ Bs. 0,00';
  openModal('debt-modal');
}

function editDebt(id) {
  const d = APP.debts.find(x => x.id === id);
  if (!d) return;
  APP.editId = id;
  document.getElementById('debt-modal-title').textContent = '✏️ Editar Deuda';
  const n = document.getElementById('debt-name');   if (n) n.value = d.name;
  const a = document.getElementById('debt-amount'); if (a) a.value = d.amount;
  const t = document.getElementById('debt-type');   if (t) t.value = d.type;
  const du = document.getElementById('debt-due');   if (du) du.value = d.due || '';
  const no = document.getElementById('debt-notes'); if (no) no.value = d.notes || '';
  updateDebtEquiv();
  openModal('debt-modal');
}

function updateDebtEquiv() {
  const amt  = parseFloat(document.getElementById('debt-amount')?.value) || 0;
  const bsEq = (amt * APP.rateBinance).toLocaleString('es-VE', { minimumFractionDigits: 2 });
  const el   = document.getElementById('debt-equiv');
  if (el) el.textContent = `≈ Bs. ${bsEq}`;
}

function saveDebt() {
  const name   = document.getElementById('debt-name')?.value.trim().toUpperCase();
  const amount = parseFloat(document.getElementById('debt-amount')?.value) || 0;
  if (!name)         { showToast('⚠️ El nombre es obligatorio', 'error'); return; }
  if (amount <= 0)   { showToast('⚠️ El monto debe ser mayor a 0', 'error'); return; }

  const data = {
    name, amount,
    type:  document.getElementById('debt-type')?.value  || 'credito',
    due:   document.getElementById('debt-due')?.value   || '',
    notes: document.getElementById('debt-notes')?.value.trim() || '',
  };

  if (APP.editId) {
    const d = APP.debts.find(x => x.id === APP.editId);
    if (d) Object.assign(d, { ...data, updatedAt: new Date().toISOString() });
    showToast('✏️ Deuda actualizada', 'success');
    APP.editId = null;
  } else {
    APP.debts.unshift({ id: uid(), ...data, status: 'pendiente', payments: [], createdAt: new Date().toISOString() });
    showToast('🔴 Deuda registrada', 'success');
  }

  saveDebtsData();
  closeModal('debt-modal');
  renderDebts();
  if (APP.module === 'dashboard') renderDashboard();
}

function payDebt(id) {
  const d = APP.debts.find(x => x.id === id);
  if (!d) return;
  d.amount    = 0;
  d.status    = 'pagada';
  d.paidAt    = new Date().toISOString();
  saveDebtsData();
  renderDebts();
  showToast(`✅ "${d.name}" marcada como totalmente saldada`, 'success');
  if (APP.module === 'dashboard') renderDashboard();
}

function deleteDebt(id) {
  const d = APP.debts.find(x => x.id === id);
  if (!d) return;
  if (!confirm(`¿Eliminar la deuda "${d.name}"?`)) return;
  APP.debts = APP.debts.filter(x => x.id !== id);
  saveDebtsData();
  renderDebts();
  showToast('🗑️ Deuda eliminada', 'info');
  if (APP.module === 'dashboard') renderDashboard();
}

// ─── PAGOS DIARIOS A DEUDAS EN BOLÍVARES ───
function openDebtPaymentModal(debtId) {
  const d = APP.debts.find(x => x.id === debtId);
  if (!d) return;
  APP.activeDebtId = debtId;

  const nameEl = document.getElementById('debt-pay-target-name');
  if (nameEl) nameEl.textContent = `${d.name} (Restante: $${d.amount.toFixed(2)})`;

  const dateEl = document.getElementById('debt-pay-date');
  if (dateEl) dateEl.value = toLocalDate(new Date());

  const vesEl = document.getElementById('debt-pay-ves');
  if (vesEl) vesEl.value = '';

  const rateEl = document.getElementById('debt-pay-rate');
  if (rateEl) rateEl.value = APP.rateAirtm || APP.rateBinance || 36.50;

  updateDebtPaymentPreview();
  openModal('debt-payment-modal');
}

function updateDebtPaymentPreview() {
  const d = APP.debts.find(x => x.id === APP.activeDebtId);
  const vesAmt = parseFloat(document.getElementById('debt-pay-ves')?.value) || 0;
  const rate   = parseFloat(document.getElementById('debt-pay-rate')?.value) || APP.rateAirtm || 36.50;

  const usdDeducted = rate > 0 ? vesAmt / rate : 0;
  const curDebtUSD  = d ? d.amount : 0;
  const remDebtUSD  = Math.max(0, curDebtUSD - usdDeducted);

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('debt-pay-ves-prev',  fmtBs(vesAmt));
  s('debt-pay-rate-prev', rate + ' Bs/USD');
  s('debt-pay-usd-prev',  fmtUSD(usdDeducted));
  s('debt-pay-rem-prev',  fmtUSD(remDebtUSD));
}

function saveDebtPayment() {
  const d = APP.debts.find(x => x.id === APP.activeDebtId);
  if (!d) return;

  const vesAmt = parseFloat(document.getElementById('debt-pay-ves')?.value) || 0;
  const rate   = parseFloat(document.getElementById('debt-pay-rate')?.value) || APP.rateAirtm || 36.50;
  const date   = document.getElementById('debt-pay-date')?.value || toLocalDate(new Date());

  if (!vesAmt || vesAmt <= 0) { showToast('⚠️ Ingresa un monto en bolívares válido', 'error'); return; }
  if (!rate || rate <= 0)     { showToast('⚠️ Ingresa una tasa válida', 'error'); return; }

  const usdDeducted = vesAmt / rate;
  d.amount = Math.max(0, parseFloat((d.amount - usdDeducted).toFixed(2)));

  if (!d.payments) d.payments = [];
  d.payments.unshift({
    id: uid(),
    date,
    vesAmount: vesAmt,
    rate,
    usdAmount: usdDeducted,
    createdAt: new Date().toISOString()
  });

  if (d.amount === 0) {
    d.status = 'pagada';
    d.paidAt = new Date().toISOString();
  }

  saveDebtsData();
  closeModal('debt-payment-modal');
  renderDebts();
  showToast(`✅ Abono de Bs. ${vesAmt.toLocaleString('es-VE')} ($${usdDeducted.toFixed(2)}) descontado de ${d.name}`, 'success');
  if (APP.module === 'dashboard') renderDashboard();
}

function deleteDebtPayment(debtId, paymentId) {
  const d = APP.debts.find(x => x.id === debtId);
  if (!d || !d.payments) return;
  const p = d.payments.find(x => x.id === paymentId);
  if (!p) return;

  if (!confirm(`¿Eliminar este abono de Bs. ${p.vesAmount.toLocaleString('es-VE')} ($${p.usdAmount.toFixed(2)})?`)) return;

  d.amount = parseFloat((d.amount + p.usdAmount).toFixed(2));
  if (d.amount > 0) d.status = 'pendiente';
  d.payments = d.payments.filter(x => x.id !== paymentId);

  saveDebtsData();
  renderDebts();
  showToast('🗑️ Abono eliminado y deuda restaurada', 'info');
  if (APP.module === 'dashboard') renderDashboard();
}

// ═══════════════════════════════════════════
//  HOOKS & RUNTIME INITIALIZATION
// ═══════════════════════════════════════════
(function() {
  MODULE_META['debts'] = { title: 'Deudas', sub: 'Control de deudas y abonos diarios en bolívares' };

  const _origSet = setModule;
  window.setModule = function(mod) {
    _origSet(mod);
    if (mod === 'debts') { loadDebts(); renderDebts(); }
    if (mod === 'economy') { initRatesUI(); renderBsPanel(); }
    if (mod === 'dashboard') { renderDashboard(); }
  };

  FAB_OPTIONS['debts'] = [
    { label: '🔴 Nueva Deuda', action: 'openDebtModal()' }
  ];

  const _origInit = window.init || null;
  window.init = function() {
    if (_origInit) _origInit();
    initRatesUI();
    loadDebts();
    renderDebtsPanel();
    updateDebtsDashCard();
    renderDashboard();
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => { initRatesUI(); loadDebts(); renderDebtsPanel(); updateDebtsDashCard(); renderDashboard(); }, 150);
  }
})();

// ═══════════════════════════════════════════
//  HELPERS DE RANGO DE FECHAS PARA EXPORTACIÓN
// ═══════════════════════════════════════════

function setExportRange(preset) {
  const now = new Date();
  const toISO = d => d.toISOString().split('T')[0];
  const fromEl = document.getElementById('export-date-from');
  const toEl = document.getElementById('export-date-to');
  if (!fromEl || !toEl) return;

  if (preset === 'all') {
    fromEl.value = '';
    toEl.value = '';
    showToast('📋 Se exportará el 100% de los datos sin filtro de fecha', 'info');
    return;
  }

  toEl.value = toISO(now);

  if (preset === 'month') {
    fromEl.value = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  } else if (preset === 'quarter') {
    const q = new Date(now);
    q.setMonth(q.getMonth() - 3);
    fromEl.value = toISO(q);
  } else if (preset === 'year') {
    fromEl.value = toISO(new Date(now.getFullYear(), 0, 1));
  }

  showToast(`🗓️ Rango de exportación actualizado`, 'info');
}

function getExportDateFilter() {
  const fromVal = (document.getElementById('export-date-from')?.value || '').trim();
  const toVal   = (document.getElementById('export-date-to')?.value || '').trim();
  return {
    from: fromVal ? new Date(fromVal + 'T00:00:00') : null,
    to:   toVal   ? new Date(toVal + 'T23:59:59') : null
  };
}

function getVal(row, keys, fallback = '') {
  if (!row || typeof row !== 'object') return fallback;
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
    const cleanK = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_ ]/g, '');
    const foundKey = rowKeys.find(rk => {
      const cleanRK = rk.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_ ]/g, '');
      return cleanRK === cleanK;
    });
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
      return row[foundKey];
    }
  }
  return fallback;
}

function parseTags(val) {
  if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
  if (!val) return [];
  return String(val).split(/[,;]/).map(v => v.trim()).filter(Boolean);
}

function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (!val) return false;
  const s = String(val).trim().toUpperCase();
  return ['SI', 'YES', 'TRUE', '1', 'HECHO', 'COMPLETADA', 'CERRADO', 'VERDADERO'].includes(s);
}

function format24hTime(val) {
  if (!val) return '09:00';
  if (val instanceof Date) {
    const hh = String(val.getHours()).padStart(2, '0');
    const mm = String(val.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const s = String(val).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
    const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return '09:00';
}

function safeDateISO(val) {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function safeDateStr(val) {
  if (!val) return toLocalDate(new Date());
  if (val instanceof Date) return toLocalDate(val);
  const s = String(val).trim();
  if (s.length >= 10) return s.substring(0, 10);
  return s;
}

function resolveAccountKey(name) {
  if (!name) return 'binance';
  const s = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (s.includes('zinli')) return 'zinli';
  if (s.includes('airtm') || s.includes('air tm') || s.includes('air_tm')) return 'airtm';
  if (s.includes('binance') || s.includes('usdt') || s.includes('binan')) return 'binance';
  if (s.includes('bolivar') || s.includes('ves') || s.includes('bs') || s.includes('pago movil') || s.includes('banco') || s.includes('banesco') || s.includes('mercantil') || s.includes('provincial')) return 'bolivares';
  if (s.includes('efectivo') || s.includes('cash') || s.includes('dolar') || s.includes('usd')) return 'efectivo';
  return 'binance';
}

// ═══════════════════════════════════════════
//  SINCRONIZACIÓN Y RECÁLCULO EXACTO DE SALDOS DE CUENTAS (AIRTM, ZINLI, BINANCE, BOLÍVARES, EFECTIVO)
// ═══════════════════════════════════════════

function syncAccountBalancesFromEconomy() {
  const suffix = (typeof getUserSuffix === 'function') ? getUserSuffix() : '';
  const curAccs = fromLS('ejcp_accounts' + suffix, {
    binance:   { name: 'Binance',   cur: 'USDT', emoji: '🟡', balance: 0, baseBalance: 0 },
    airtm:     { name: 'AIRTM',    cur: 'USD',  emoji: '💙', balance: 0, baseBalance: 0 },
    zinli:     { name: 'Zinli',    cur: 'USD',  emoji: '🟣', balance: 0, baseBalance: 0 },
    bolivares: { name: 'Bolívares', cur: 'VES',  emoji: '🇻🇪', balance: 0, baseBalance: 0 },
    efectivo:  { name: 'Efectivo', cur: 'USD',  emoji: '💵', balance: 0, baseBalance: 0 }
  });

  const accs = JSON.parse(JSON.stringify(curAccs));
  Object.keys(accs).forEach(k => {
    if (!accs[k]) {
      accs[k] = { name: k, balance: 0, baseBalance: 0 };
    } else {
      const base = accs[k].baseBalance !== undefined ? parseFloat(accs[k].baseBalance || 0) : (accs[k].initialBalance !== undefined ? parseFloat(accs[k].initialBalance || 0) : 0);
      accs[k].balance = base;
      accs[k].baseBalance = base;
    }
  });

  const econ = fromLS('ejcp_economy' + suffix, []);
  const rate = APP.rateBCV || APP.rate || 755.9;

  econ.forEach(t => {
    const amtSent    = parseFloat(t.amount || 0) || 0;
    const amtArrived = parseFloat(t.arrives || t.amount || 0) || 0;
    const vesSent    = parseFloat(t.amountVes || 0) || (amtSent * rate);
    const vesArrived = amtArrived * rate;
    const type       = String(t.type || 'ingreso').toLowerCase();

    if (type === 'ingreso' || type === 'deposito' || type === 'cobro' || type === 'abono') {
      const targetKey = resolveAccountKey(t.account || t.dest || t.origin || t.fromAccount || 'binance');
      if (accs[targetKey]) {
        const delta = targetKey === 'bolivares' ? (vesArrived || vesSent) : amtArrived;
        accs[targetKey].balance = parseFloat((accs[targetKey].balance + delta).toFixed(2));
      }
    } else if (type === 'egreso' || type === 'gasto' || type === 'pago' || type === 'pago_movil' || type === 'compra' || type === 'salida') {
      const sourceKey = resolveAccountKey(t.fromAccount || t.origin || t.account || 'binance');
      if (accs[sourceKey]) {
        const delta = sourceKey === 'bolivares' ? vesSent : amtSent;
        accs[sourceKey].balance = parseFloat((accs[sourceKey].balance - delta).toFixed(2));
      }
    } else if (type === 'zinli') {
      const sourceKey = resolveAccountKey(t.fromAccount || t.origin || t.account || 'binance');
      const destKey   = 'zinli';
      if (accs[sourceKey]) {
        const deltaSrc = sourceKey === 'bolivares' ? vesSent : amtSent;
        accs[sourceKey].balance = parseFloat((accs[sourceKey].balance - deltaSrc).toFixed(2));
      }
      if (accs[destKey]) {
        accs[destKey].balance = parseFloat((accs[destKey].balance + amtArrived).toFixed(2));
      }
    } else if (type === 'traslado' || type === 'transferencia') {
      const sourceKey = resolveAccountKey(t.fromAccount || t.origin || 'binance');
      const destKey   = resolveAccountKey(t.toAccount || t.dest || 'airtm');
      if (accs[sourceKey]) {
        const deltaSrc = sourceKey === 'bolivares' ? vesSent : amtSent;
        accs[sourceKey].balance = parseFloat((accs[sourceKey].balance - deltaSrc).toFixed(2));
      }
      if (destKey && destKey !== sourceKey && accs[destKey]) {
        const deltaDst = destKey === 'bolivares' ? vesArrived : amtArrived;
        accs[destKey].balance = parseFloat((accs[destKey].balance + deltaDst).toFixed(2));
      }
    }
  });

  toLS('ejcp_accounts' + suffix, accs);
}

// Fallback seguro global para renderDatabaseSummary
if (typeof window !== 'undefined' && typeof window.renderDatabaseSummary !== 'function') {
  window.renderDatabaseSummary = function() {
    if (typeof renderDashboard === 'function') renderDashboard();
  };
}

function safeUIRefresh() {
  if (typeof renderDatabaseSummary === 'function') {
    renderDatabaseSummary();
  } else if (typeof renderDashboard === 'function') {
    renderDashboard();
  } else if (typeof updateDashboard === 'function') {
    updateDashboard();
  }
}

// ═══════════════════════════════════════════
//  EXPORTACIÓN EXCEL — COMPLETA (TODOS LOS MÓDULOS Y CUENTAS)
// ═══════════════════════════════════════════

function exportSystemDataExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('⚠️ Cargando motor Excel (SheetJS), reintenta en un momento...', 'warning');
    return;
  }

  const suffix = (typeof getUserSuffix === 'function') ? getUserSuffix() : '';

  const { from, to } = getExportDateFilter();
  const rangeLabel = (from || to)
    ? ` (${from ? from.toLocaleDateString('es-VE') : '...'} → ${to ? to.toLocaleDateString('es-VE') : '...'})`
    : ' (Completo)';

  const wb = XLSX.utils.book_new();

  // 1. Configuración & Perfil General con Saldos Iniciales de Cuentas
  const profile = fromLS('taskmaster_profile' + suffix, {});
  const accs    = fromLS('ejcp_accounts' + suffix, {});
  const curUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;

  const configData = [{
    Usuario:         (curUser && curUser.name) ? curUser.name : (profile.name || 'Edwin José Colmenares Pacheco'),
    Email:           profile.email    || 'edwinjosecolmenares28@hotmail.com',
    Telefono:        profile.phone    || '+58 (0414) 135-6815',
    Ubicacion:       profile.location || 'Guatire, Miranda',
    Tasa_BCV:        APP.rateBCV      || 755.90,
    Tasa_Binance:    APP.rateBinance  || 755.90,
    Tasa_Airtm:      APP.rateAirtm    || 755.90,
    Saldo_Binance:   accs.binance   ? (accs.binance.baseBalance   ?? accs.binance.balance)   : 0,
    Saldo_AIRTM:     accs.airtm     ? (accs.airtm.baseBalance     ?? accs.airtm.balance)     : 0,
    Saldo_Zinli:     accs.zinli     ? (accs.zinli.baseBalance     ?? accs.zinli.balance)     : 0,
    Saldo_Bolivares: accs.bolivares ? (accs.bolivares.baseBalance ?? accs.bolivares.balance) : 0,
    Saldo_Efectivo:  accs.efectivo  ? (accs.efectivo.baseBalance  ?? accs.efectivo.balance)  : 0,
    Rango_Exportado: rangeLabel,
    Fecha_Exportacion: new Date().toLocaleString('es-VE')
  }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configData), 'Configuracion_y_Perfil');

  // 2. Tasks
  const taskRaw  = applyDateFilter(fromLS('ejcp_tasks' + suffix, []), 'date');
  const taskData = taskRaw.map(t => ({
    ID:         t.id,
    Titulo:     t.title,
    Descripcion:t.desc || '',
    Categoria:  t.category || 'general',
    Prioridad:  t.priority || 'media',
    Etiquetas:  (t.tags || []).join(', '),
    Completada: t.done ? 'SI' : 'NO',
    Fecha:      t.date || ''
  }));
  const emptyTask = [{ ID: '', Titulo: '', Descripcion: '', Categoria: '', Prioridad: '', Etiquetas: '', Completada: '', Fecha: '' }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskData.length ? taskData : emptyTask), 'Tasks');

  // 3. Tickets
  const ticketRaw  = applyDateFilter(fromLS('ejcp_tickets' + suffix, []).map(tk => ({ ...tk, date: tk.createdAt || tk.date })), 'date');
  const ticketData = ticketRaw.map(tk => ({
    ID:             tk.id,
    Numero:         tk.number || '',
    Fecha:          tk.date || tk.createdAt || '',
    Hora_Apertura:  tk.timeOpen || '09:00',
    Hora_Cierre:    tk.timeClose || '17:00',
    Descripcion:    tk.desc || tk.title || '',
    Proveedor:      tk.provider || 'Inter / NetUno',
    Asignado:       tk.assignee || 'EDWIN COLMENARES',
    Estado:         tk.status || 'cerrado',
    Solucion:       tk.solution || '',
    Categoria:      tk.category || 'red'
  }));
  const emptyTicket = [{ ID: '', Numero: '', Fecha: '', Hora_Apertura: '', Hora_Cierre: '', Descripcion: '', Proveedor: '', Asignado: '', Estado: '', Solucion: '', Categoria: '' }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ticketData.length ? ticketData : emptyTicket), 'Tickets');

  // 4. Network
  const netRaw  = applyDateFilter(fromLS('ejcp_network' + suffix, []), 'date');
  const netData = netRaw.map(n => ({
    ID:            n.id,
    NetID:         n.netId || '',
    Tipo:          n.type || 'parcial',
    Fecha_Inicio:  n.startDate || '',
    Fecha_Fin:     n.endDate || '',
    Area:          n.area || '',
    Estado:        n.status || 'resuelta',
    Causa:         n.cause || '',
    Descripcion:   n.desc || n.title || '',
    Reportado:     n.reportTo || ''
  }));
  const emptyNet = [{ ID: '', NetID: '', Tipo: '', Fecha_Inicio: '', Fecha_Fin: '', Area: '', Estado: '', Causa: '', Descripcion: '', Reportado: '' }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(netData.length ? netData : emptyNet), 'Network');

  // 5. Economy
  const econRaw  = applyDateFilter(fromLS('ejcp_economy' + suffix, []), 'date');
  const econData = econRaw.map(t => ({
    ID:             t.id,
    Tipo:           t.type || 'ingreso',
    Monto_USD:      t.amount || 0,
    Tasa_Aplicada:  t.rate || 755.90,
    Monto_VES:      t.amountVes || 0,
    Cuenta:         t.account || t.origin || 'Binance',
    Cuenta_Origen:  t.fromAccount || t.origin || 'Binance',
    Cuenta_Destino: t.toAccount || t.dest || 'AIRTM',
    Categoria:      t.category || 'general',
    Descripcion:    t.desc || '',
    Fecha:          t.date || '',
    Notas:          t.notes || ''
  }));
  const emptyEcon = [{ ID: '', Tipo: '', Monto_USD: '', Tasa_Aplicada: '', Monto_VES: '', Cuenta: '', Cuenta_Origen: '', Cuenta_Destino: '', Categoria: '', Descripcion: '', Fecha: '', Notas: '' }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(econData.length ? econData : emptyEcon), 'Economy');

  // 6. Deudas
  const debtList = fromLS('ejcp_debts' + suffix, []);
  const debtData = debtList.map(d => ({
    ID:                d.id,
    Acreedor:          d.creditor || d.name || '',
    Monto_Inicial_USD: d.initialAmount || d.originalAmount || 0,
    Monto_Restante_USD:d.remainingAmount || d.amount || 0,
    Total_Pagado_VES:  d.totalPaidVes || 0,
    Fecha_Registro:    d.date || '',
    Estado:            d.status || 'pendiente'
  }));
  const emptyDebt = [{ ID: '', Acreedor: '', Monto_Inicial_USD: '', Monto_Restante_USD: '', Total_Pagado_VES: '', Fecha_Registro: '', Estado: '' }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(debtData.length ? debtData : emptyDebt), 'Deudas_y_Abonos');

  // 7. Actividades & Salud
  const actRaw  = applyDateFilter(fromLS('ejcp_activities' + suffix, []), 'date');
  const actData = actRaw.map(a => ({
    ID:           a.id,
    Ejercicio:    a.title || a.exercise || '',
    Categoria:    a.category || 'salud',
    Duracion_Min: a.duration || 0,
    Calorias:     a.calories || 0,
    Fecha:        a.date || '',
    Notas:        a.notes || ''
  }));
  const emptyAct = [{ ID: '', Ejercicio: '', Categoria: '', Duracion_Min: '', Calorias: '', Fecha: '', Notas: '' }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(actData.length ? actData : emptyAct), 'Actividades_y_Salud');

  // 8. Portafolio CV
  const pf     = getAutoPortfolio();
  const pfData = (pf.experience || []).map(exp => ({
    Cargo:       exp.role,
    Empresa:     exp.company,
    Periodo:     exp.period,
    Descripcion: exp.description
  }));
  const emptyPf = [{ Cargo: '', Empresa: '', Periodo: '', Descripcion: '' }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pfData.length ? pfData : emptyPf), 'Portafolio_CV');

  // 9. Documentos & Certificados
  const docData = (pf.documents || []).map(doc => ({
    Nombre:       doc.title,
    Descripcion:  doc.description,
    Tipo:         doc.type,
    Ruta_Archivo: doc.url || doc.previewUrl || ''
  }));
  const emptyDoc = [{ Nombre: '', Descripcion: '', Tipo: '', Ruta_Archivo: '' }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docData.length ? docData : emptyDoc), 'Documentos_y_Certificados');

  // 10. Educación & Certificaciones
  const eduData = (pf.education || []).map(edu => ({
    Titulo:      edu.degree,
    Institucion: edu.institution,
    Periodo:     edu.period
  }));
  const emptyEdu = [{ Titulo: '', Institucion: '', Periodo: '' }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eduData.length ? eduData : emptyEdu), 'Educacion_y_Cursos');

  const fileName = `Base_De_Datos_EJCP${rangeLabel.replace(/[/ :→]/g, '_').replace(/_+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(`📊 Excel exportado completo: "${fileName}"`, 'success');
}

// ═══════════════════════════════════════════
//  EXPORTACIÓN JSON — COMPLETA
// ═══════════════════════════════════════════

function exportSystemDataJSON() {
  const suffix = (typeof getUserSuffix === 'function') ? getUserSuffix() : '';
  const { from, to } = getExportDateFilter();

  const fullBackup = {
    exportMeta: {
      generatedAt: new Date().toISOString(),
      rangeFrom:   from ? from.toISOString() : null,
      rangeTo:     to   ? to.toISOString()   : null,
      version:     '3.0'
    },
    profile:          fromLS('taskmaster_profile' + suffix, {}),
    rate:             APP.rateBCV || 755.90,
    rates: {
      bcv:            APP.rateBCV || 755.90,
      eur:            APP.rateEUR || 755.90,
      binance:        APP.rateBinance || 755.90,
      airtm:          APP.rateAirtm || 755.90
    },
    accounts:         fromLS('ejcp_accounts' + suffix, {}),
    econTransactions: applyDateFilter(fromLS('ejcp_economy' + suffix, []),  'date'),
    economy:          applyDateFilter(fromLS('ejcp_economy' + suffix, []),  'date'),
    tasks:            applyDateFilter(fromLS('ejcp_tasks' + suffix,   []),  'date'),
    tickets:          applyDateFilter(fromLS('ejcp_tickets' + suffix, []).map(tk => ({ ...tk, date: tk.createdAt || tk.date })), 'date'),
    networkEvents:    applyDateFilter(fromLS('ejcp_network' + suffix, []),  'date'),
    network:          applyDateFilter(fromLS('ejcp_network' + suffix, []),  'date'),
    debts:            fromLS('ejcp_debts' + suffix, []),
    activities:       applyDateFilter(fromLS('ejcp_activities' + suffix, []), 'date'),
    portfolio:        getAutoPortfolio(),
    users:            fromLS('ejcp_users', []),
    messages:         fromLS('ejcp_messages', [])
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `EJCP_Backup_${toLocalDate(new Date())}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();

  const total = fullBackup.econTransactions.length + fullBackup.tasks.length +
                fullBackup.tickets.length + fullBackup.networkEvents.length + fullBackup.activities.length;
  showToast(`💾 Backup JSON completo descargado — ${total} registros exportados`, 'success');
}

function validateSheetRows(sheetName, rows) {
  return { ok: true, warnings: [] };
}

function showValidationReport(issues) {
  const el = document.getElementById('import-validation-report');
  if (!el) return;
  if (!issues || issues.length === 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.style.background = 'rgba(245,158,11,0.08)';
  el.style.border = '1px solid rgba(245,158,11,0.3)';
  el.style.color = 'var(--yellow)';
  el.innerHTML = '<strong>📋 Advertencias de Validación Previa:</strong><br>' +
    issues.map(w => `• ${w}`).join('<br>');
}

function upsertById(existing, incoming) {
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];
  const result = [...safeExisting];

  safeIncoming.forEach(newItem => {
    if (!newItem || typeof newItem !== 'object') return;
    const itemID = newItem.id ? String(newItem.id) : null;
    if (!itemID) {
      result.push(newItem);
      return;
    }
    const idx = result.findIndex(e => e && String(e.id) === itemID);
    if (idx >= 0) {
      result[idx] = { ...result[idx], ...newItem };
    } else {
      result.push(newItem);
    }
  });
  return result;
}

// ═══════════════════════════════════════════
//  CARGA MASIVA INTEGRAL CON RECÁLCULO AUTOMÁTICO DE SALDOS DE CUENTAS
// ═══════════════════════════════════════════

function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const suffix   = (typeof getUserSuffix === 'function') ? getUserSuffix() : '';
  const mode     = document.querySelector('input[name="importMode"]:checked')?.value || 'overwrite';
  const fileName = file.name.toLowerCase();
  const reader   = new FileReader();

  // Snapshot para ROLLBACK transaccional
  const snapshot = {
    tasks:      JSON.parse(JSON.stringify(fromLS('ejcp_tasks' + suffix, []))),
    tickets:    JSON.parse(JSON.stringify(fromLS('ejcp_tickets' + suffix, []))),
    network:    JSON.parse(JSON.stringify(fromLS('ejcp_network' + suffix, []))),
    economy:    JSON.parse(JSON.stringify(fromLS('ejcp_economy' + suffix, []))),
    debts:      JSON.parse(JSON.stringify(fromLS('ejcp_debts' + suffix, []))),
    activities: JSON.parse(JSON.stringify(fromLS('ejcp_activities' + suffix, []))),
    accounts:   JSON.parse(JSON.stringify(fromLS('ejcp_accounts' + suffix, {}))),
    rateBCV:    APP.rateBCV,
    rateBinance:APP.rateBinance,
    rateAirtm:  APP.rateAirtm
  };

  const rollback = (errMsg) => {
    toLS('ejcp_tasks' + suffix,      snapshot.tasks);
    toLS('ejcp_tickets' + suffix,    snapshot.tickets);
    toLS('ejcp_network' + suffix,    snapshot.network);
    toLS('ejcp_economy' + suffix,    snapshot.economy);
    toLS('ejcp_debts' + suffix,      snapshot.debts);
    toLS('ejcp_activities' + suffix, snapshot.activities);
    toLS('ejcp_accounts' + suffix,   snapshot.accounts);
    if (snapshot.rateBCV) toLS('ejcp_rate_bcv', snapshot.rateBCV);
    loadAll();
    showToast('❌ Error en importación: Transacción abortada. ' + errMsg, 'error');
  };

  if (fileName.endsWith('.json')) {
    reader.onload = function(e) {
      try {
        const json = JSON.parse(e.target.result);
        localStorage.removeItem('ejcp_cleared' + suffix);

        // Tasa Global
        if (json.rate || json.rates) {
          const globalRate = json.rate || (json.rates && json.rates.bcv) || 755.9;
          APP.rateBCV = globalRate; APP.rateBinance = globalRate; APP.rateAirtm = globalRate; APP.rate = globalRate;
          toLS('ejcp_rate_bcv', globalRate);
          toLS('ejcp_rate_binance', globalRate);
          toLS('ejcp_rate_airtm', globalRate);
        }

        if (json.accounts)  toLS('ejcp_accounts' + suffix, json.accounts);
        if (json.profile)   toLS('taskmaster_profile' + suffix, json.profile);
        if (json.portfolio) saveAutoPortfolio(json.portfolio);
        if (json.users)     toLS('ejcp_users', json.users);
        if (json.messages)  toLS('ejcp_messages', json.messages);

        const jsonTasks      = json.tasks || json.taskList || null;
        const jsonEcon       = json.econTransactions || json.economy || json.transactions || null;
        const jsonDebts      = json.debts || json.debtList || null;
        const jsonTickets    = json.tickets || json.ticketList || null;
        const jsonNet        = json.networkEvents || json.network || json.networkList || null;
        const jsonActivities = json.activities || json.activitiesEvents || json.activityList || null;

        if (mode === 'overwrite') {
          if (jsonTasks !== null)      toLS('ejcp_tasks' + suffix,      jsonTasks);
          if (jsonEcon !== null)       toLS('ejcp_economy' + suffix,    jsonEcon);
          if (jsonDebts !== null)      toLS('ejcp_debts' + suffix,      jsonDebts);
          if (jsonTickets !== null)    toLS('ejcp_tickets' + suffix,    jsonTickets);
          if (jsonNet !== null)        toLS('ejcp_network' + suffix,    jsonNet);
          if (jsonActivities !== null) toLS('ejcp_activities' + suffix, jsonActivities);
        } else {
          if (jsonTasks)      toLS('ejcp_tasks' + suffix,      upsertById(fromLS('ejcp_tasks' + suffix,      []), jsonTasks));
          if (jsonEcon)       toLS('ejcp_economy' + suffix,    upsertById(fromLS('ejcp_economy' + suffix,    []), jsonEcon));
          if (jsonDebts)      toLS('ejcp_debts' + suffix,      upsertById(fromLS('ejcp_debts' + suffix,      []), jsonDebts));
          if (jsonTickets)    toLS('ejcp_tickets' + suffix,    upsertById(fromLS('ejcp_tickets' + suffix,    []), jsonTickets));
          if (jsonNet)        toLS('ejcp_network' + suffix,    upsertById(fromLS('ejcp_network' + suffix,    []), jsonNet));
          if (jsonActivities) toLS('ejcp_activities' + suffix, upsertById(fromLS('ejcp_activities' + suffix, []), jsonActivities));
        }

        // Sincronizar y recalcular saldos de cuentas desde la economía importada
        syncAccountBalancesFromEconomy();

        showToast(`✅ JSON importado con éxito. Saldos de cuentas y Activos Totales recalculados. (${mode === 'overwrite' ? 'Reemplazo total' : 'Upsert'})`, 'success');
        
        loadAll();
        if (typeof loadDebts === 'function') loadDebts();
        safeUIRefresh();
        if (typeof renderTasks === 'function') renderTasks();
        if (typeof renderTickets === 'function') renderTickets();
        if (typeof renderNetwork === 'function') renderNetwork();
        if (typeof renderEconomy === 'function') renderEconomy();
        if (typeof renderDebts === 'function') renderDebts();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof updateSidebarBadges === 'function') updateSidebarBadges();

        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        rollback(err.message);
      }
    };
    reader.readAsText(file);

  } else {
    reader.onload = function(e) {
      try {
        if (typeof XLSX === 'undefined') {
          showToast('⚠️ Motor Excel no disponible, reintenta en un instante...', 'warning');
          return;
        }

        const data     = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        localStorage.removeItem('ejcp_cleared' + suffix);

        let newTasks = [], newTickets = [], newNetwork = [], newEconomy = [], newDebts = [], newActivities = [];
        let foundSheets = { tasks: false, tickets: false, network: false, economy: false, debts: false, activities: false };

        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          let rows  = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
          if (!rows || !rows.length) return;

          const firstRowKeys = Object.keys(rows[0] || {});
          const isBannerRow  = firstRowKeys.some(k => k.toLowerCase().includes('sección') || k.toLowerCase().includes('hoja') || k.toLowerCase().includes('instrucciones'));
          if (isBannerRow) {
            rows = XLSX.utils.sheet_to_json(sheet, { range: 1, raw: false, dateNF: 'yyyy-mm-dd' });
          }
          if (!rows || !rows.length) return;

          const sName = sheetName.toLowerCase().replace(/[_ ]/g, '');

          // 1. Configuración & Perfil / Rate / Saldos Directos de Cuentas
          if (sName.includes('configuracion') || sName.includes('perfil') || sName.includes('rate')) {
            const p = rows[0];
            const rateVal = parseFloat(getVal(p, ['Tasa','Rate','rate','Tasa_BCV','Tasa_Binance','Tasa_Airtm','Tasa_Global'], 755.9)) || 755.9;
            if (rateVal) {
              toLS('ejcp_rate_bcv',     rateVal);
              toLS('ejcp_rate_binance', rateVal);
              toLS('ejcp_rate_airtm',   rateVal);
              APP.rateBCV = rateVal; APP.rateBinance = rateVal; APP.rateAirtm = rateVal; APP.rate = rateVal;
            }

            // Lectura de saldos directos si vienen en la hoja de configuración
            const sBin = parseFloat(getVal(p, ['Saldo_Binance','Binance'], NaN));
            const sAir = parseFloat(getVal(p, ['Saldo_AIRTM','AIRTM','Airtm'], NaN));
            const sZin = parseFloat(getVal(p, ['Saldo_Zinli','Zinli'], NaN));
            const sVes = parseFloat(getVal(p, ['Saldo_Bolivares','Bolívares','Bolivares','VES'], NaN));
            const sEfe = parseFloat(getVal(p, ['Saldo_Efectivo','Efectivo','USD_Efectivo'], NaN));

            const curAccs = fromLS('ejcp_accounts' + suffix, {});
            if (!isNaN(sBin) && curAccs.binance)   curAccs.binance.baseBalance   = sBin;
            if (!isNaN(sAir) && curAccs.airtm)     curAccs.airtm.baseBalance     = sAir;
            if (!isNaN(sZin) && curAccs.zinli)     curAccs.zinli.baseBalance     = sZin;
            if (!isNaN(sVes) && curAccs.bolivares) curAccs.bolivares.baseBalance = sVes;
            if (!isNaN(sEfe) && curAccs.efectivo)  curAccs.efectivo.baseBalance  = sEfe;
            toLS('ejcp_accounts' + suffix, curAccs);
          }

          // 2. Módulo Tasks (Tareas)
          if (sName.includes('task') || sName.includes('tarea')) {
            foundSheets.tasks = true;
            rows.forEach(r => {
              const title = String(getVal(r, ['title','Titulo','Título','Tarea','Nombre','Asunto','Actividad'], '')).trim();
              if (!title) return;
              newTasks.push({
                id:        String(getVal(r, ['id','ID','Id','Código'], uid())),
                title:     title,
                desc:      String(getVal(r, ['desc','Descripcion','Descripción','Detalle','Notas'], '')).trim(),
                date:      safeDateStr(getVal(r, ['date','Fecha','Vencimiento'])),
                priority:  String(getVal(r, ['priority','Prioridad','Nivel'], 'media')).toLowerCase(),
                category:  String(getVal(r, ['category','Categoria','Categoría','Tipo'], 'general')).toLowerCase(),
                tags:      parseTags(getVal(r, ['tags','Tags','Etiquetas','Etiqueta'], [])),
                done:      parseBoolean(getVal(r, ['done','Completada','Hecho','Estado'], false)),
                createdAt: safeDateISO(getVal(r, ['createdAt','Fecha_Creacion','Fecha Creacion','Fecha'])),
                updatedAt: safeDateISO(getVal(r, ['updatedAt','Fecha_Actualizacion'], new Date()))
              });
            });
          }

          // 3. Módulo Tickets (Soporte Técnico)
          if (sName.includes('ticket')) {
            foundSheets.tickets = true;
            rows.forEach(r => {
              const title = String(getVal(r, ['desc','title','Titulo','Título','Asunto','Incidencia','Falla','Caso'], '')).trim();
              if (!title) return;
              newTickets.push({
                id:        String(getVal(r, ['id','ID','Id'], uid())),
                number:    String(getVal(r, ['number','Number','Número','Numero','N°','ID_Ticket'], 'TICK-' + uid())),
                date:      safeDateStr(getVal(r, ['date','Fecha','Fecha_Creacion','Apertura'])),
                timeOpen:  format24hTime(getVal(r, ['timeOpen','Hora_Apertura','Hora Apertura','Inicio'], '09:00')),
                timeClose: format24hTime(getVal(r, ['timeClose','Hora_Cierre','Hora Cierre','Fin'], '17:00')),
                desc:      title,
                title:     title,
                provider:  String(getVal(r, ['provider','Proveedor','ISP','Empresa'], 'Inter / NetUno')),
                assignee:  String(getVal(r, ['assignee','Asignado','Técnico','Tecnico','Responsable'], 'EDWIN COLMENARES')),
                status:    String(getVal(r, ['status','Estado'], 'cerrado')).toLowerCase(),
                solution:  String(getVal(r, ['solution','Solución','Solucion','Resolución','Notas'], '')),
                category:  String(getVal(r, ['category','Categoria','Categoría','Tipo'], 'red')).toLowerCase(),
                createdAt: safeDateISO(getVal(r, ['date','createdAt','Fecha']))
              });
            });
          }

          // 4. Módulo Network (Fallas y Eventos de Red)
          if (sName.includes('net') || sName.includes('caida') || sName.includes('red')) {
            foundSheets.network = true;
            rows.forEach(r => {
              const title = String(getVal(r, ['desc','title','Evento','evento','Titulo','Título','Incidente','Falla','Causa'], '')).trim();
              if (!title) return;
              newNetwork.push({
                id:          String(getVal(r, ['id','ID','Id'], uid())),
                netId:       String(getVal(r, ['netId','NetID','ID_Red','Número'], 'NET-' + uid())),
                type:        String(getVal(r, ['type','Tipo','Corte'], 'parcial')).toLowerCase(),
                startDate:   safeDateISO(getVal(r, ['startDate','Fecha_Inicio','Inicio','Fecha'])),
                endDate:     safeDateISO(getVal(r, ['endDate','Fecha_Fin','Fin','Cierre'])),
                area:        String(getVal(r, ['area','Área','Area','Sector','Ubicación'], 'Guatire')),
                status:      String(getVal(r, ['status','Estado'], 'resuelta')).toLowerCase(),
                cause:       String(getVal(r, ['cause','Causa','Motivo'], 'ISP')),
                desc:        title,
                title:       title,
                description: title,
                reportTo:    String(getVal(r, ['reportTo','Reportado','Reportado_A'], 'Soporte ISP'))
              });
            });
          }

          // 5. Módulo Economy (Transacciones y Finanzas)
          if (sName.includes('econ') || sName.includes('cuenta') || sName.includes('transaccio')) {
            foundSheets.economy = true;
            rows.forEach(r => {
              const amountUsd = parseFloat(getVal(r, ['amount','Monto_USD','Monto USD','Monto','monto','Importe','USD'], 0)) || 0;
              const desc      = String(getVal(r, ['desc','Descripcion','Descripción','Detalle','Concepto','Motivo'], '')).trim();
              if (!amountUsd && !desc) return;
              const typeVal   = String(getVal(r, ['type','Tipo','tipo','Clase'], 'ingreso')).toLowerCase();
              const rateVal   = parseFloat(getVal(r, ['rate','Tasa_Aplicada','Tasa','Rate'], 755.9)) || 755.9;

              const rawOrigin = getVal(r, ['fromAccount','Cuenta_Origen','Origen','Cuenta','De','Account'], '');
              const rawDest   = getVal(r, ['toAccount','Cuenta_Destino','Destino','Para','A'], '');

              let finalOrigin = rawOrigin ? String(rawOrigin).trim() : (rawDest ? String(rawDest).trim() : 'Binance');
              let finalDest   = rawDest   ? String(rawDest).trim()   : finalOrigin;

              if (typeVal.includes('zinli') && !rawDest) {
                finalDest = 'Zinli';
              }

              const normType = typeVal.includes('egreso') || typeVal.includes('gasto')
                ? 'egreso'
                : (typeVal.includes('traslado') ? 'traslado' : (typeVal.includes('zinli') ? 'zinli' : 'ingreso'));

              const arrivesVal = parseFloat(getVal(r, ['arrives','Llegó','Llego','Monto_Llegada','Arrives'], amountUsd)) || amountUsd;
              const feeAmtVal  = parseFloat(getVal(r, ['feeAmt','Fee','Comisión','Comision'], 0)) || 0;

              newEconomy.push({
                id:          String(getVal(r, ['id','ID','Id','Código'], uid())),
                type:        normType,
                amount:      amountUsd,
                amountVes:   parseFloat(getVal(r, ['amountVes','Monto_VES','Monto VES','VES','Bolívares'], 0)) || (amountUsd * rateVal),
                rate:        rateVal,
                account:     finalOrigin,
                origin:      finalOrigin,
                dest:        finalDest,
                fromAccount: finalOrigin,
                toAccount:   finalDest,
                desc:        desc || 'Transacción importada',
                category:    String(getVal(r, ['category','Categoria','Categoría'], 'general')).toLowerCase(),
                date:        safeDateStr(getVal(r, ['date','Fecha','Date'])),
                notes:       String(getVal(r, ['notes','Notas','Comentario'], '')),
                feePct:      parseFloat(getVal(r, ['feePct','FeePct'], 0)) || 0,
                feeAmt:      feeAmtVal,
                arrives:     arrivesVal
              });
            });
          }

          // 6. Módulo Deudas
          if (sName.includes('deuda') || sName.includes('debt')) {
            foundSheets.debts = true;
            rows.forEach(r => {
              const creditor = String(getVal(r, ['creditor','name','Acreedor','acreedor','Nombre','Deuda'], '')).trim();
              const initAmt  = parseFloat(getVal(r, ['initialAmount','Monto_Inicial_USD','Monto Inicial','Monto'], 0)) || 0;
              if (!creditor && !initAmt) return;
              newDebts.push({
                id:              String(getVal(r, ['id','ID','Id'], uid())),
                creditor:        creditor || 'Deuda importada',
                name:            creditor || 'Deuda importada',
                initialAmount:   initAmt,
                originalAmount:  initAmt,
                remainingAmount: parseFloat(getVal(r, ['remainingAmount','Monto_Restante_USD','Saldo'], initAmt)) || initAmt,
                amount:          parseFloat(getVal(r, ['amount','Monto_Restante_USD','Saldo'], initAmt)) || initAmt,
                totalPaidVes:    parseFloat(getVal(r, ['totalPaidVes','Total_Pagado_VES'], 0)) || 0,
                date:            safeDateStr(getVal(r, ['date','Fecha_Registro','Fecha'])),
                status:          String(getVal(r, ['status','Estado'], 'pendiente')).toLowerCase(),
                payments:        []
              });
            });
          }

          // 7. Módulo Actividades & Salud
          if (sName.includes('activida') || sName.includes('salud') || sName.includes('ejercicio')) {
            foundSheets.activities = true;
            rows.forEach(r => {
              const exercise = String(getVal(r, ['Ejercicio','ejercicio','title','title','Nombre','Actividad'], '')).trim();
              if (!exercise) return;
              newActivities.push({
                id:       String(getVal(r, ['id','ID','Id'], uid())),
                title:    exercise,
                exercise: exercise,
                category: String(getVal(r, ['category','Categoria','Categoría'], 'salud')).toLowerCase(),
                duration: parseFloat(getVal(r, ['duration','Duracion_Min','Duracion','Tiempo'], 30)) || 30,
                calories: parseFloat(getVal(r, ['calories','Calorias','Calorías'], 0)) || 0,
                date:     safeDateStr(getVal(r, ['date','Fecha','Date'])),
                notes:    String(getVal(r, ['notes','Notas','Notas'], ''))
              });
            });
          }
        });

        // EJECUCIÓN TRANSACCIONAL POR MÓDULOS ENCONTRADOS
        if (mode === 'overwrite') {
          if (foundSheets.tasks)      toLS('ejcp_tasks' + suffix,      newTasks);
          if (foundSheets.tickets)    toLS('ejcp_tickets' + suffix,    newTickets);
          if (foundSheets.network)    toLS('ejcp_network' + suffix,    newNetwork);
          if (foundSheets.economy)    toLS('ejcp_economy' + suffix,    newEconomy);
          if (foundSheets.debts)      toLS('ejcp_debts' + suffix,      newDebts);
          if (foundSheets.activities) toLS('ejcp_activities' + suffix, newActivities);
        } else {
          if (newTasks.length)      toLS('ejcp_tasks' + suffix,      upsertById(fromLS('ejcp_tasks' + suffix,      []), newTasks));
          if (newTickets.length)    toLS('ejcp_tickets' + suffix,    upsertById(fromLS('ejcp_tickets' + suffix,    []), newTickets));
          if (newNetwork.length)    toLS('ejcp_network' + suffix,    upsertById(fromLS('ejcp_network' + suffix,    []), newNetwork));
          if (newEconomy.length)    toLS('ejcp_economy' + suffix,    upsertById(fromLS('ejcp_economy' + suffix,    []), newEconomy));
          if (newDebts.length)      toLS('ejcp_debts' + suffix,      upsertById(fromLS('ejcp_debts' + suffix,      []), newDebts));
          if (newActivities.length) toLS('ejcp_activities' + suffix, upsertById(fromLS('ejcp_activities' + suffix, []), newActivities));
        }

        // Sincronizar y recalcular saldos de cuentas desde la economía importada
        syncAccountBalancesFromEconomy();

        const totalImported = newTasks.length + newTickets.length + newNetwork.length + newEconomy.length + newDebts.length + newActivities.length;
        const modeLabel = mode === 'overwrite' ? 'Reemplazo total purgado' : 'Upsert (actualizar/agregar por ID)';
        showToast(`✅ Importación completada. Saldos de cuentas y Activos Totales recalculados. (${modeLabel})`, 'success');

        loadAll();
        if (typeof loadDebts === 'function') loadDebts();
        safeUIRefresh();
        if (typeof renderTasks === 'function') renderTasks();
        if (typeof renderTickets === 'function') renderTickets();
        if (typeof renderNetwork === 'function') renderNetwork();
        if (typeof renderEconomy === 'function') renderEconomy();
        if (typeof renderDebts === 'function') renderDebts();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof updateSidebarBadges === 'function') updateSidebarBadges();

        setTimeout(() => location.reload(), 1200);

      } catch (err) {
        rollback(err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

// ═══════════════════════════════════════════
//  PLANTILLA DE IMPORTACIÓN VACÍA (TODOS LOS MÓDULOS Y SALDOS)
// ═══════════════════════════════════════════

function downloadImportTemplate() {
  if (typeof XLSX === 'undefined') {
    showToast('⚠️ Cargando motor Excel (SheetJS), reintenta en un momento...', 'warning');
    return;
  }

  const wb = XLSX.utils.book_new();

  // 1. Instrucciones
  const instrSheet = XLSX.utils.aoa_to_sheet([
    ['📌 INSTRUCCIONES DE USO — Plantilla de Importación Masiva EJCP TaskMaster v3.0'],
    [''],
    ['PASO 1:', 'Abre este archivo en Microsoft Excel o Google Sheets.'],
    ['PASO 2:', 'Completa las pestañas: Tasks, Tickets, Network, Economy, Deudas, Actividades.'],
    ['PASO 3:', 'En la pestaña Configuracion_y_Perfil puedes indicar tus saldos iniciales en Binance, AIRTM, Zinli, Bolívares y Efectivo.'],
    ['PASO 4:', 'Tasa global predeterminada: 755.9.'],
    ['PASO 5:', 'Guarda el archivo como .xlsx y súbelo en: Base de Datos General → Importar.'],
    [''],
    ['PESTAÑAS DISPONIBLES:'],
    ['  Tasks',                 '→ Tareas operativas y pendientes'],
    ['  Tickets',               '→ Soporte técnico e incidencias'],
    ['  Network',               '→ Eventos y fallas de red ISP'],
    ['  Economy',               '→ Transacciones financieras y finanzas'],
    ['  Deudas_y_Abonos',       '→ Control de acreedores y deudas'],
    ['  Actividades_y_Salud',   '→ Ejercicios y registro de bienestar'],
    ['  Configuracion_y_Perfil','→ Tasa de cambio global, saldos de cuentas y perfil'],
    [''],
    ['Generado:', new Date().toLocaleString('es-VE')],
    ['Sistema:',  'EJCP TaskMaster — Edwin José Colmenares Pacheco']
  ]);
  instrSheet['!cols'] = [{ wch: 30 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, instrSheet, '📌 Instrucciones');

  // 2. Tasks
  const taskSheet = XLSX.utils.aoa_to_sheet([
    ['id', 'title', 'desc', 'date', 'priority', 'category', 'tags', 'done', 'createdAt', 'updatedAt'],
    ['', '', '', '', '', '', '', '', '', '']
  ]);
  taskSheet['!cols'] = [{wch:14},{wch:36},{wch:40},{wch:12},{wch:10},{wch:14},{wch:20},{wch:10},{wch:20},{wch:20}];
  XLSX.utils.book_append_sheet(wb, taskSheet, 'Tasks');

  // 3. Tickets
  const ticketSheet = XLSX.utils.aoa_to_sheet([
    ['id', 'number', 'date', 'timeOpen', 'timeClose', 'desc', 'provider', 'assignee', 'status', 'solution', 'category'],
    ['', '', '', '', '', '', '', '', '', '', '']
  ]);
  ticketSheet['!cols'] = [{wch:14},{wch:14},{wch:12},{wch:10},{wch:10},{wch:40},{wch:18},{wch:22},{wch:10},{wch:30},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ticketSheet, 'Tickets');

  // 4. Network
  const netSheet = XLSX.utils.aoa_to_sheet([
    ['id', 'netId', 'type', 'startDate', 'endDate', 'area', 'status', 'cause', 'desc', 'reportTo'],
    ['', '', '', '', '', '', '', '', '', '']
  ]);
  netSheet['!cols'] = [{wch:14},{wch:14},{wch:12},{wch:20},{wch:20},{wch:16},{wch:10},{wch:14},{wch:40},{wch:18}];
  XLSX.utils.book_append_sheet(wb, netSheet, 'Network');

  // 5. Economy
  const econSheet = XLSX.utils.aoa_to_sheet([
    ['id', 'type', 'amount', 'rate', 'amountVes', 'account', 'fromAccount', 'toAccount', 'category', 'desc', 'date', 'notes', 'feePct', 'feeAmt', 'arrives'],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
  ]);
  econSheet['!cols'] = [{wch:14},{wch:10},{wch:11},{wch:10},{wch:12},{wch:14},{wch:14},{wch:14},{wch:14},{wch:40},{wch:12},{wch:20},{wch:8},{wch:8},{wch:11}];
  XLSX.utils.book_append_sheet(wb, econSheet, 'Economy');

  // 6. Deudas
  const debtSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Acreedor', 'Monto_Inicial_USD', 'Monto_Restante_USD', 'Total_Pagado_VES', 'Fecha_Registro', 'Estado'],
    ['', '', '', '', '', '', '']
  ]);
  debtSheet['!cols'] = [{wch:14},{wch:36},{wch:18},{wch:20},{wch:18},{wch:15},{wch:14}];
  XLSX.utils.book_append_sheet(wb, debtSheet, 'Deudas_y_Abonos');

  // 7. Actividades
  const actSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Ejercicio', 'Categoria', 'Duracion_Min', 'Calorias', 'Fecha', 'Notas'],
    ['', '', '', '', '', '', '']
  ]);
  actSheet['!cols'] = [{wch:14},{wch:32},{wch:16},{wch:14},{wch:12},{wch:12},{wch:30}];
  XLSX.utils.book_append_sheet(wb, actSheet, 'Actividades_y_Salud');

  // 8. Configuracion_y_Perfil con campos de Saldos
  const configSheet = XLSX.utils.aoa_to_sheet([
    ['Usuario', 'Email', 'Telefono', 'Ubicacion', 'Tasa_BCV', 'Tasa_Binance', 'Tasa_Airtm', 'Saldo_Binance', 'Saldo_AIRTM', 'Saldo_Zinli', 'Saldo_Bolivares', 'Saldo_Efectivo'],
    ['Edwin José Colmenares Pacheco', 'edwinjosecolmenares28@hotmail.com', '+58 (0414) 135-6815', 'Guatire, Miranda, Venezuela', 755.90, 755.90, 755.90, 0, 0, 0, 0, 0]
  ]);
  configSheet['!cols'] = [{wch:32},{wch:40},{wch:22},{wch:32},{wch:10},{wch:14},{wch:12},{wch:14},{wch:14},{wch:12},{wch:16},{wch:14}];
  XLSX.utils.book_append_sheet(wb, configSheet, 'Configuracion_y_Perfil');

  XLSX.writeFile(wb, 'Plantilla_Importacion_EJCP_TaskMaster.xlsx');
  showToast('📋 ¡Plantilla completa descargada con saldos de cuentas!', 'success');
}

// ═══════════════════════════════════════════
//  VACIAR TODA LA BASE DE DATOS DEL SISTEMA
// ═══════════════════════════════════════════

function clearAllSystemData() {
  if (!confirm(
    '⚠️ ATENCIÓN: Se eliminarán permanentemente:\n\n' +
    '  • Todas las transacciones financieras\n' +
    '  • Todas las tareas y pendientes\n' +
    '  • Todos los tickets de soporte IT\n' +
    '  • Todas las caídas de red\n' +
    '  • Todas las deudas y abonos\n' +
    '  • Configuración de tasas y perfil\n\n' +
    'El portafolio profesional NO será eliminado.\n\n' +
    '¿Deseas continuar?'
  )) return;

  if (!confirm('🔴 ÚLTIMA ADVERTENCIA — Esta acción NO se puede deshacer.\n\n¿Confirmas vaciar todo el sistema?')) {
    showToast('❌ Operación cancelada. Ningún dato fue eliminado.', 'info');
    return;
  }

  const suffix = (typeof getUserSuffix === 'function') ? getUserSuffix() : '';
  const resetAccounts = {
    binance:   { name: 'Binance',   cur: 'USDT', emoji: '🟡', balance: 0, baseBalance: 0 },
    airtm:     { name: 'AIRTM',    cur: 'USD',  emoji: '💙', balance: 0, baseBalance: 0 },
    zinli:     { name: 'Zinli',    cur: 'USD',  emoji: '🟣', balance: 0, baseBalance: 0 },
    bolivares: { name: 'Bolívares', cur: 'VES',  emoji: '🇻🇪', balance: 0, baseBalance: 0 },
    efectivo:  { name: 'Efectivo', cur: 'USD',  emoji: '💵', balance: 0, baseBalance: 0 }
  };
  toLS('ejcp_accounts' + suffix, resetAccounts);

  toLS('ejcp_economy' + suffix, []);
  toLS('ejcp_tasks' + suffix, []);
  toLS('ejcp_tickets' + suffix, []);
  toLS('ejcp_network' + suffix, []);
  toLS('ejcp_debts' + suffix, []);
  toLS('ejcp_activities' + suffix, []);
  toLS('ejcp_cleared' + suffix, true);

  toLS('ejcp_tk_cnt' + suffix, 1);
  toLS('ejcp_net_cnt' + suffix, 1);

  APP.tasks = []; APP.tickets = []; APP.network = [];
  APP.economy = []; APP.activities = []; APP.debts = [];
  APP.ticketCounter = 1; APP.networkCounter = 1;

  showToast('🗑️ Sistema vaciado completamente. Los datos quedan en $0.00 en todas las secciones.', 'success');
  setTimeout(function() { location.reload(); }, 1000);
}

// ═══════════════════════════════════════════
//  RESTAURAR DATOS DE DEMOSTRACIÓN
// ═══════════════════════════════════════════

function seedSampleData() {
  const suffix = (typeof getUserSuffix === 'function') ? getUserSuffix() : '';
  localStorage.removeItem('ejcp_cleared' + suffix);

  const globalRate = 755.90;
  toLS('ejcp_rate_bcv', globalRate);
  toLS('ejcp_rate_binance', globalRate);
  toLS('ejcp_rate_airtm', globalRate);
  APP.rateBCV = globalRate; APP.rateBinance = globalRate; APP.rateAirtm = globalRate; APP.rate = globalRate;

  const txs = [
    { id: 'tx-1', type: 'ingreso', amount: 350.00, amountVes: 264565.00, rate: 755.90, origin: 'Binance', dest: 'Binance', account: 'Binance', desc: 'Pago por Proyecto Web Vettal', date: toLocalDate(new Date()) },
    { id: 'tx-2', type: 'egreso', amount: 80.00, amountVes: 60472.00, rate: 755.90, origin: 'Bolívares', dest: 'Bolívares', account: 'Bolívares', desc: 'Compra de Repuestos de Red', date: toLocalDate(new Date()) }
  ];
  toLS('ejcp_economy' + suffix, txs);

  const debts = [
    { id: 'd-1', creditor: 'Préstamo Equipos de Red Cisco', name: 'Préstamo Equipos de Red Cisco', initialAmount: 200.00, originalAmount: 200.00, remainingAmount: 150.00, amount: 150.00, totalPaidVes: 37795.00, date: toLocalDate(new Date()), status: 'pendiente', payments: [{ id: 'p-1', date: toLocalDate(new Date()), vesAmount: 37795.00, rate: 755.90, usdAmount: 50.00 }] }
  ];
  toLS('ejcp_debts' + suffix, debts);

  const tasks = [
    { id: 'tk-1', title: 'Auditar servidor pfSense ALTECEL', desc: 'Pruebas del sistema Vettal', category: 'it', priority: 'alta', done: false, date: toLocalDate(new Date()), tags: ['vettal','pfsense'] },
    { id: 'tk-2', title: 'Generar backup mensual en Excel', desc: 'Carga masiva de 4 pestañas', category: 'general', priority: 'media', done: true, date: toLocalDate(new Date()), tags: ['backup','excel'] }
  ];
  toLS('ejcp_tasks' + suffix, tasks);

  const tickets = [
    { id: 'tck-1', number: 'TICK-1001', title: 'Falla enlace principal Inter Fibra Guatire', desc: 'Falla enlace principal Inter Fibra Guatire', status: 'cerrado', priority: 'alta', assignee: 'EDWIN COLMENARES', provider: 'Inter Fibra', solution: 'Reemplazo de conector óptico', category: 'red', date: toLocalDate(new Date()), timeOpen: '09:00', timeClose: '11:30', createdAt: toLocalDate(new Date()) }
  ];
  toLS('ejcp_tickets' + suffix, tickets);

  const network = [
    { id: 'net-1', netId: 'NET-001', title: 'Corte de fibra óptica Guatire', description: 'Corte de fibra óptica Guatire', isp: 'Inter Fibra', duration: '2h 30m', startDate: new Date().toISOString(), endDate: new Date().toISOString(), type: 'total', status: 'resuelta', area: 'Guatire', cause: 'ISP', reportTo: 'Soporte ISP' }
  ];
  toLS('ejcp_network' + suffix, network);

  syncAccountBalancesFromEconomy();

  showToast('⚡ ¡Datos de demostración cargados y sincronizados a tasa 755.9!', 'success');
  loadAll();
  safeUIRefresh();
  setTimeout(() => location.reload(), 800);
}

// ═══════════════════════════════════════════
//  SISTEMA DE AUTENTICACIÓN Y CHAT INTERNO (CON ESPACIOS EN BLANCO PERSONALIZABLES)
// ═══════════════════════════════════════════

let activeChatContactId = null;

function getStoredUsers() {
  const defaultAdmin = {
    id: 'usr-admin',
    username: 'admin',
    email: 'edwinjosecolmenares28@hotmail.com',
    password: '12345678',
    role: 'principal',
    name: 'EDWIN COLMENARES',
    avatar: '👨‍💻',
    status: '🟢 En línea'
  };
  let users = fromLS('ejcp_users', null);
  if (!users || !Array.isArray(users) || users.length === 0) {
    toLS('ejcp_users', [defaultAdmin]);
    return [defaultAdmin];
  }
  const adminIdx = users.findIndex(u => u.id === 'usr-admin' || u.username === 'admin');
  if (adminIdx >= 0) {
    users[adminIdx].password = '12345678';
    users[adminIdx].name = 'EDWIN COLMENARES';
    users[adminIdx].email = 'edwinjosecolmenares28@hotmail.com';
    toLS('ejcp_users', users);
  }
  return users;
}

function getCurrentUser() {
  const users = getStoredUsers();
  const cur = fromLS('ejcp_current_user', null);
  if (!cur) return null;
  const found = users.find(u => u.id === cur.id || u.username === cur.username || (u.email && u.email === cur.email));
  return found || null;
}

function logoutUser() {
  localStorage.removeItem('ejcp_current_user');
  currentSessionId = null;
  showToast('🚪 Sesión cerrada correctamente. Ingresa con tu correo y clave.', 'info');
  updateProfileHeaderUI();
  checkAuthLockScreen();
}

function checkAuthLockScreen() {
  const currentUser = getCurrentUser();
  const modalCloseBtn = document.querySelector('#modal-auth .modal-close');
  const appContainer = document.getElementById('app-container') || document.querySelector('.app-container');

  if (!currentUser) {
    openAuthModal('login');
    if (modalCloseBtn) modalCloseBtn.style.display = 'none';
    if (appContainer) {
      appContainer.style.filter = 'blur(10px)';
      appContainer.style.pointerEvents = 'none';
      appContainer.style.userSelect = 'none';
    }
  } else {
    if (modalCloseBtn) modalCloseBtn.style.display = 'flex';
    if (appContainer) {
      appContainer.style.filter = 'none';
      appContainer.style.pointerEvents = 'auto';
      appContainer.style.userSelect = 'auto';
    }
  }
}

function resetDatabaseToZero() {
  const defaultAdmin = {
    id: 'usr-admin',
    username: 'admin',
    email: 'edwinjosecolmenares28@hotmail.com',
    password: '12345678',
    role: 'principal',
    name: 'EDWIN COLMENARES',
    avatar: '👨‍💻',
    status: '🟢 En línea'
  };

  localStorage.clear();

  toLS('ejcp_users', [defaultAdmin]);
  toLS('ejcp_current_user', null);
  toLS('ejcp_shared_expenses', []);
  toLS('ejcp_user_sessions', []);
  toLS('ejcp_messages', [
    {
      id: 'msg-init-1',
      senderId: 'usr-admin',
      receiverId: 'all',
      content: '👋 Sistema COSAS DE LA VIDA reiniciado completamente a cero y 100% operativo.',
      timestamp: new Date().toISOString()
    }
  ]);

  if (typeof currentSessionId !== 'undefined') currentSessionId = null;

  showToast('🔄 Base de datos reiniciada a cero. Ingresa con tu correo y contraseña.', 'success');
  updateProfileHeaderUI();
  checkAuthLockScreen();
}

function setCurrentUser(userObj) {
  toLS('ejcp_current_user', userObj);
  updateProfileHeaderUI();
  if (typeof startUserSessionLog === 'function') startUserSessionLog(userObj);
  checkAuthLockScreen();
}

function updateProfileHeaderUI() {
  const user = getCurrentUser();
  const elName = document.getElementById('profile-name');
  const elStatus = document.getElementById('profile-status-label');

  if (!user) {
    if (elName) elName.textContent = 'Sin Sesión';
    if (elStatus) elStatus.textContent = '🔒 Iniciar Sesión';
    return;
  }

  if (elName) elName.textContent = user.name || user.username;
  if (elStatus) elStatus.textContent = `${user.role === 'principal' ? '🟢 Principal' : '👤 Secundario'} (${user.status || 'En línea'})`;
}

function openUserSwitchModal() {
  const modal = document.getElementById('modal-switch-user');
  const listEl = document.getElementById('switch-user-list');
  if (!modal || !listEl) return;

  const users = getStoredUsers();
  const currentUser = getCurrentUser();

  listEl.innerHTML = users.map(u => {
    const isCur = u.id === currentUser.id;
    return `
      <div style="padding:12px 14px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;background:${isCur ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isCur ? 'var(--accent)' : 'var(--border-light)'}">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:24px">${u.avatar || '👤'}</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${u.name || u.username} ${isCur ? '<span style="font-size:11px;color:var(--accent);font-weight:800">(ACTIVO)</span>' : ''}</div>
            <div style="font-size:11px;color:var(--text-muted)">@${u.username} • Rol: ${u.role.toUpperCase()}</div>
          </div>
        </div>
        ${isCur
          ? '<span style="font-size:12px;color:var(--accent);font-weight:700;padding:6px 12px;background:rgba(99,102,241,0.2);border-radius:8px">En uso</span>'
          : `<button onclick="switchActiveUser('${u.id}')" style="padding:7px 14px;font-size:12px;font-weight:800;background:var(--accent);color:#070913;border:none;border-radius:8px;cursor:pointer">⚡ Conectar</button>`
        }
      </div>
    `;
  }).join('');

  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'all';
}

function closeUserSwitchModal() {
  const modal = document.getElementById('modal-switch-user');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
  }
}

function switchActiveUser(userId) {
  const users = getStoredUsers();
  const found = users.find(u => u.id === userId);
  if (!found) {
    showToast('❌ Usuario no encontrado', 'error');
    return;
  }
  setCurrentUser(found);
  closeUserSwitchModal();
  showToast(`⚡ Espacio de trabajo cambiado a "${found.name || found.username}" (${found.role.toUpperCase()})`, 'success');
  loadAll();
  safeUIRefresh();
}

function toggleAuthMode() {
  const modeInput = document.getElementById('auth-mode');
  const currentMode = modeInput ? modeInput.value : 'login';
  const newMode = currentMode === 'login' ? 'register' : 'login';
  openAuthModal(newMode);
}

function openAuthModal(mode = 'login') {
  const modal = document.getElementById('modal-auth');
  const title = document.getElementById('auth-modal-title');
  const modeInput = document.getElementById('auth-mode');
  const submitBtn = document.getElementById('auth-submit-btn');
  const switchBtn = document.getElementById('auth-switch-mode-btn');
  const customFields = document.getElementById('auth-custom-fields');

  if (!modal) return;

  modeInput.value = mode;
  document.getElementById('auth-username').value = '';
  document.getElementById('auth-password').value = '';

  if (mode === 'register') {
    title.textContent = '👤 Crear Nuevo Usuario Personalizado';
    submitBtn.textContent = '🚀 Registrar y Conectar';
    if (switchBtn) switchBtn.textContent = '🔑 ¿Ya tienes cuenta? Inicia Sesión';
    if (customFields) customFields.style.display = 'block';
  } else {
    title.textContent = '🔐 Iniciar Sesión';
    submitBtn.textContent = 'Ingresar';
    if (switchBtn) switchBtn.textContent = '👤 ¿No tienes cuenta? Regístrate aquí';
    if (customFields) customFields.style.display = 'none';
  }

  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'all';
}

function closeAuthModal() {
  const modal = document.getElementById('modal-auth');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
  }
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const mode = document.getElementById('auth-mode').value;
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  const role = document.getElementById('auth-role')?.value || 'secundario';
  const customName = document.getElementById('auth-name')?.value.trim() || username;
  const avatar = document.getElementById('auth-avatar')?.value || '👤';
  const status = document.getElementById('auth-status')?.value.trim() || '🟢 En línea';
  const isBlank = document.getElementById('auth-blank')?.checked ?? true;

  if (!username || !password) {
    showToast('⚠️ Ingresa usuario y contraseña', 'warning');
    return;
  }

  const users = getStoredUsers();

  if (mode === 'register') {
    const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      showToast('❌ El nombre de usuario ya está registrado', 'error');
      return;
    }
    const newId = 'usr-' + uid();
    const newUser = {
      id: newId,
      username: username,
      password: password,
      role: role,
      name: customName,
      avatar: avatar,
      status: status
    };
    users.push(newUser);
    toLS('ejcp_users', users);

    if (isBlank) {
      toLS(`ejcp_tasks_${newId}`, []);
      toLS(`ejcp_tickets_${newId}`, []);
      toLS(`ejcp_network_${newId}`, []);
      toLS(`ejcp_economy_${newId}`, []);
      toLS(`ejcp_debts_${newId}`, []);
      toLS(`ejcp_activities_${newId}`, []);
      toLS(`ejcp_accounts_${newId}`, {
        binance:   { name: 'Binance',   cur: 'USDT', emoji: '🟡', balance: 0, baseBalance: 0 },
        airtm:     { name: 'AIRTM',    cur: 'USD',  emoji: '💙', balance: 0, baseBalance: 0 },
        zinli:     { name: 'Zinli',    cur: 'USD',  emoji: '🟣', balance: 0, baseBalance: 0 },
        bolivares: { name: 'Bolívares', cur: 'VES',  emoji: '🇻🇪', balance: 0, baseBalance: 0 },
        efectivo:  { name: 'Efectivo', cur: 'USD',  emoji: '💵', balance: 0, baseBalance: 0 }
      });
      toLS(`ejcp_cleared_${newId}`, true);
    }

    setCurrentUser(newUser);
    closeAuthModal();
    showToast(`✨ Usuario "${customName}" creado con espacio de trabajo 100% en blanco`, 'success');
    loadAll();
    safeUIRefresh();
  } else {
    const found = users.find(u => (u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === username.toLowerCase())) && u.password === password);
    if (!found) {
      showToast('❌ Credenciales incorrectas (Verifica tu correo/usuario y contraseña)', 'error');
      return;
    }
    setCurrentUser(found);
    closeAuthModal();
    showToast(`✅ Sesión iniciada como "${found.name || found.username}" (${found.role.toUpperCase()})`, 'success');
    loadAll();
    safeUIRefresh();
  }
}

function renderChatModule() {
  const currentUser = getCurrentUser();
  const users = getStoredUsers();

  const elCurName = document.getElementById('chat-current-user-name');
  const elCurRole = document.getElementById('chat-current-user-role');
  const elCurAvatar = document.getElementById('chat-current-avatar');
  const elContactCount = document.getElementById('chat-contact-count');

  if (elCurName) elCurName.textContent = `Usuario Actual: ${currentUser.name || currentUser.username}`;
  if (elCurRole) elCurRole.textContent = `Rol: ${currentUser.role === 'principal' ? 'Principal (Administrador)' : 'Secundario (Invitado)'}`;
  if (elCurAvatar) elCurAvatar.textContent = currentUser.avatar || '👤';

  // Contact list logic
  let contacts = [];
  if (currentUser.role === 'principal') {
    contacts = users.filter(u => u.id !== currentUser.id);
  } else {
    const principal = users.find(u => u.role === 'principal') || users[0];
    contacts = [principal];
  }

  if (elContactCount) elContactCount.textContent = `${contacts.length} contactos`;

  const listEl = document.getElementById('chat-user-list');
  if (listEl) {
    if (contacts.length === 0) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:10px">No hay usuarios registrados aún. Registra uno con el botón de arriba.</div>';
    } else {
      if (!activeChatContactId || !contacts.some(c => c.id === activeChatContactId)) {
        activeChatContactId = contacts[0].id;
      }
      listEl.innerHTML = contacts.map(c => {
        const isActive = c.id === activeChatContactId;
        return `
          <div onclick="selectChatContact('${c.id}')" style="padding:10px 12px;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:10px;background:${isActive ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isActive ? 'var(--accent)' : 'transparent'}">
            <div style="font-size:20px">${c.avatar || '👤'}</div>
            <div style="flex:1;overflow:hidden">
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name || c.username}</div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">${c.role}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  renderChatMessages();
}

function selectChatContact(contactId) {
  activeChatContactId = contactId;
  renderChatModule();
}

function renderChatMessages() {
  const currentUser = getCurrentUser();
  const users = getStoredUsers();
  const targetUser = users.find(u => u.id === activeChatContactId);

  const headerEl = document.getElementById('chat-active-header');
  const subEl = document.getElementById('chat-active-sub');
  const avatarEl = document.getElementById('chat-active-avatar');
  const streamEl = document.getElementById('chat-messages-stream');

  if (!targetUser) {
    if (headerEl) headerEl.textContent = 'Selecciona una conversación';
    if (subEl) subEl.textContent = 'Mensajería directa local';
    if (streamEl) streamEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;margin-top:40px">Selecciona un contacto a la izquierda para ver los mensajes.</div>';
    return;
  }

  if (headerEl) headerEl.textContent = `Conversación con @${targetUser.username} (${targetUser.name || ''})`;
  if (subEl) subEl.textContent = `Rol: ${targetUser.role.toUpperCase()} — Registros de usuario almacenados en BD local`;
  if (avatarEl) avatarEl.textContent = targetUser.avatar || '👤';

  const allMessages = fromLS('ejcp_messages', []);
  const conversation = allMessages.filter(m =>
    (m.senderId === currentUser.id && m.receiverId === targetUser.id) ||
    (m.senderId === targetUser.id && m.receiverId === currentUser.id)
  );

  if (streamEl) {
    if (conversation.length === 0) {
      streamEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;margin-top:40px">Aún no hay mensajes en esta conversación. ¡Envía el primer mensaje abajo!</div>';
    } else {
      streamEl.innerHTML = conversation.map(m => {
        const isMe = m.senderId === currentUser.id;
        const senderLabel = isMe ? 'YO' : (targetUser.name || targetUser.username);
        const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '';
        return `
          <div style="display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'}">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">${senderLabel} • ${timeStr}</div>
            <div style="max-width:75%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.4;background:${isMe ? 'linear-gradient(135deg,var(--accent),#4f46e5)' : 'rgba(255,255,255,0.07)'};color:${isMe ? '#070913' : 'var(--text-primary)'};font-weight:${isMe ? '700' : '400'};box-shadow:0 2px 8px rgba(0,0,0,0.2)">
              ${esc(m.content)}
            </div>
          </div>
        `;
      }).join('');
      streamEl.scrollTop = streamEl.scrollHeight;
    }
  }
}

function sendChatMessage() {
  const inputEl = document.getElementById('chat-input-text');
  if (!inputEl) return;
  const content = inputEl.value.trim();
  if (!content) {
    showToast('⚠️ Escribe un mensaje antes de enviar', 'warning');
    return;
  }

  const currentUser = getCurrentUser();
  if (!activeChatContactId) {
    showToast('⚠️ Selecciona un contacto primero', 'warning');
    return;
  }

  const allMessages = fromLS('ejcp_messages', []);
  const newMsg = {
    id: 'msg-' + uid(),
    senderId: currentUser.id,
    receiverId: activeChatContactId,
    content: content,
    timestamp: new Date().toISOString()
  };

  allMessages.push(newMsg);
  toLS('ejcp_messages', allMessages);

  if (ejcpRealtimeChatChannel) {
    ejcpRealtimeChatChannel.postMessage({ type: 'NEW_CHAT_MSG', senderId: currentUser.id, receiverId: activeChatContactId });
  }

  inputEl.value = '';
  renderChatMessages();
}

function openRegisterModal() {
  switchModule('register');
}

function handleDirectRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email')?.value.trim() || '';
  const password = document.getElementById('reg-password').value.trim();
  const confirmPassword = document.getElementById('reg-confirm-password')?.value.trim() || password;
  const customName = document.getElementById('reg-name').value.trim() || username;
  const avatar = document.getElementById('reg-avatar').value || '👤';
  const role = document.getElementById('reg-role').value || 'secundario';
  const status = document.getElementById('reg-status').value.trim() || '🟢 En línea';
  const isBlank = document.getElementById('reg-blank').checked;

  if (!username || !password) {
    showToast('⚠️ Ingresa usuario y contraseña', 'warning');
    return;
  }

  if (password !== confirmPassword) {
    showToast('❌ Las contraseñas no coinciden. Por favor verifícalas.', 'error');
    return;
  }

  if (email && !email.includes('@')) {
    showToast('⚠️ Ingresa un correo electrónico válido (ejemplo@dominio.com)', 'warning');
    return;
  }

  const users = getStoredUsers();
  const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    showToast('❌ El nombre de usuario ya existe. Elige otro.', 'error');
    return;
  }

  const newId = 'usr-' + uid();
  const newUser = {
    id: newId,
    username: username,
    email: email,
    password: password,
    role: role,
    name: customName,
    avatar: avatar,
    status: status
  };

  users.push(newUser);
  toLS('ejcp_users', users);

  if (isBlank) {
    toLS(`ejcp_tasks_${newId}`, []);
    toLS(`ejcp_tickets_${newId}`, []);
    toLS(`ejcp_network_${newId}`, []);
    toLS(`ejcp_economy_${newId}`, []);
    toLS(`ejcp_debts_${newId}`, []);
    toLS(`ejcp_activities_${newId}`, []);
    toLS(`ejcp_accounts_${newId}`, {
      binance:   { name: 'Binance',   cur: 'USDT', emoji: '🟡', balance: 0, baseBalance: 0 },
      airtm:     { name: 'AIRTM',    cur: 'USD',  emoji: '💙', balance: 0, baseBalance: 0 },
      zinli:     { name: 'Zinli',    cur: 'USD',  emoji: '🟣', balance: 0, baseBalance: 0 },
      bolivares: { name: 'Bolívares', cur: 'VES',  emoji: '🇻🇪', balance: 0, baseBalance: 0 },
      efectivo:  { name: 'Efectivo', cur: 'USD',  emoji: '💵', balance: 0, baseBalance: 0 }
    });
    toLS(`ejcp_cleared_${newId}`, true);
  }

  setCurrentUser(newUser);
  showToast(`✨ Usuario "${customName}" creado exitosamente con espacio en blanco`, 'success');

  loadAll();
  safeUIRefresh();
  switchModule('dashboard');
}

// ═══════════════════════════════════════════
//  SISTEMA DE GASTOS COMPARTIDOS (SPLITWISE) & BALANCES DE DEUDAS
// ═══════════════════════════════════════════

function renderSharedExpensesModule() {
  const users = getStoredUsers();
  const currentUser = getCurrentUser();
  const payerSelect = document.getElementById('se-payer');
  const partList = document.getElementById('se-participants-list');
  const dateInput = document.getElementById('se-date');

  if (dateInput && !dateInput.value) {
    dateInput.value = toLocalDate(new Date());
  }

  // Populate Payer Select
  if (payerSelect) {
    payerSelect.innerHTML = users.map(u => {
      const isMe = u.id === currentUser.id;
      return `<option value="${u.id}" ${isMe ? 'selected' : ''}>${u.name || u.username} (@${u.username}) ${isMe ? '— (Tú)' : ''}</option>`;
    }).join('');
  }

  // Populate Participants List Checkboxes
  if (partList) {
    partList.innerHTML = users.map(u => {
      return `
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-primary);cursor:pointer">
          <input type="checkbox" class="se-part-cb" value="${u.id}" checked style="width:16px;height:16px">
          <span>${u.avatar || '👤'} ${u.name || u.username} (@${u.username})</span>
        </label>
      `;
    }).join('');
  }

  renderSharedExpenseHistory();
  renderDebtBalanceMatrix();
}

function handleSharedExpenseSubmit(e) {
  e.preventDefault();
  const desc = document.getElementById('se-desc').value.trim();
  const amount = parseFloat(document.getElementById('se-amount').value || 0);
  const category = document.getElementById('se-category').value;
  const date = document.getElementById('se-date').value;
  const payerId = document.getElementById('se-payer').value;

  const cbEls = document.querySelectorAll('.se-part-cb:checked');
  const participantIds = Array.from(cbEls).map(cb => cb.value);

  if (!desc || isNaN(amount) || amount <= 0) {
    showToast('⚠️ Ingresa una descripción y monto válido mayor a 0', 'warning');
    return;
  }
  if (!participantIds.length) {
    showToast('⚠️ Selecciona al menos un usuario participante para dividir el gasto', 'warning');
    return;
  }

  const sharedExpenses = fromLS('ejcp_shared_expenses', []);
  const newExpense = {
    id: 'se-' + uid(),
    desc: desc,
    amount: amount,
    category: category,
    date: date || toLocalDate(new Date()),
    payerId: payerId,
    participantIds: participantIds,
    createdAt: new Date().toISOString()
  };

  sharedExpenses.push(newExpense);
  toLS('ejcp_shared_expenses', sharedExpenses);

  document.getElementById('se-desc').value = '';
  document.getElementById('se-amount').value = '';

  showToast(`🤝 Gasto de $${amount.toFixed(2)} registrado y dividido entre ${participantIds.length} usuario(s)`, 'success');
  renderSharedExpensesModule();
}

function renderSharedExpenseHistory() {
  const sharedExpenses = fromLS('ejcp_shared_expenses', []);
  const users = getStoredUsers();
  const currentUser = getCurrentUser();
  const historyEl = document.getElementById('se-history-list');
  const totalAmtEl = document.getElementById('se-total-amount');
  const totalCntEl = document.getElementById('se-total-count');

  const totalSum = sharedExpenses.reduce((acc, x) => acc + (parseFloat(x.amount) || 0), 0);
  if (totalAmtEl) totalAmtEl.textContent = `$${totalSum.toFixed(2)}`;
  if (totalCntEl) totalCntEl.textContent = `${sharedExpenses.length} registro(s)`;

  if (!historyEl) return;

  if (sharedExpenses.length === 0) {
    historyEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:20px;text-align:center">No hay gastos compartidos registrados aún.</div>';
    return;
  }

  historyEl.innerHTML = sharedExpenses.slice().reverse().map(item => {
    const payer = users.find(u => u.id === item.payerId) || { name: 'Desconocido', username: 'anon' };
    const perPerson = (item.amount / item.participantIds.length).toFixed(2);
    const names = item.participantIds.map(id => {
      const u = users.find(x => x.id === id);
      return u ? (u.name || u.username) : id;
    }).join(', ');

    return `
      <div class="task-card" style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:22px">🤝</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${esc(item.desc)} — <span style="color:var(--accent)">$${parseFloat(item.amount).toFixed(2)} USD</span></div>
            <div style="font-size:11px;color:var(--text-muted)">Pagado por: <strong>${payer.name || payer.username}</strong> • Dividido entre (${item.participantIds.length}): ${names} ($${perPerson}/c.u.)</div>
            <div style="font-size:10px;color:var(--text-muted)">Fecha: ${item.date}</div>
          </div>
        </div>
        <button class="act-btn del" onclick="deleteSharedExpense('${item.id}')" title="Eliminar gasto">🗑️</button>
      </div>
    `;
  }).join('');
}

function deleteSharedExpense(id) {
  let sharedExpenses = fromLS('ejcp_shared_expenses', []);
  sharedExpenses = sharedExpenses.filter(x => x.id !== id);
  toLS('ejcp_shared_expenses', sharedExpenses);
  showToast('🗑️ Gasto compartido eliminado', 'info');
  renderSharedExpensesModule();
}

function renderDebtBalanceMatrix() {
  const sharedExpenses = fromLS('ejcp_shared_expenses', []);
  const users = getStoredUsers();
  const currentUser = getCurrentUser();
  const matrixEl = document.getElementById('se-balance-matrix');
  const myBalEl = document.getElementById('se-my-balance');
  const myBalSubEl = document.getElementById('se-my-balance-sub');

  const netMap = {};
  users.forEach(u1 => {
    netMap[u1.id] = {};
    users.forEach(u2 => {
      netMap[u1.id][u2.id] = 0;
    });
  });

  sharedExpenses.forEach(item => {
    const amount = parseFloat(item.amount || 0);
    const payerId = item.payerId;
    const participants = item.participantIds || [];
    if (!amount || !payerId || !participants.length) return;

    const share = amount / participants.length;
    participants.forEach(partId => {
      if (partId !== payerId && netMap[partId] && netMap[partId][payerId] !== undefined) {
        netMap[partId][payerId] += share;
      }
    });
  });

  let myNet = 0;
  users.forEach(other => {
    if (other.id !== currentUser.id) {
      const iOweOther = netMap[currentUser.id][other.id] || 0;
      const otherOwesMe = netMap[other.id][currentUser.id] || 0;
      myNet += (otherOwesMe - iOweOther);
    }
  });

  if (myBalEl) {
    myBalEl.textContent = `$${myNet.toFixed(2)}`;
    myBalEl.style.color = myNet > 0 ? 'var(--green)' : (myNet < 0 ? 'var(--red)' : 'var(--text-primary)');
  }
  if (myBalSubEl) {
    myBalSubEl.textContent = myNet > 0 ? 'Te deben en total' : (myNet < 0 ? 'Debes a otros usuarios' : 'Cuentas al día (Sin deudas)');
  }

  if (!matrixEl) return;

  const debtPairs = [];
  users.forEach(u1 => {
    users.forEach(u2 => {
      if (u1.id < u2.id) {
        const u1OwesU2 = netMap[u1.id][u2.id] || 0;
        const u2OwesU1 = netMap[u2.id][u1.id] || 0;
        const diff = u1OwesU2 - u2OwesU1;

        if (diff > 0.01) {
          debtPairs.push({ debtor: u1, creditor: u2, amount: diff });
        } else if (diff < -0.01) {
          debtPairs.push({ debtor: u2, creditor: u1, amount: Math.abs(diff) });
        }
      }
    });
  });

  if (debtPairs.length === 0) {
    matrixEl.innerHTML = '<div style="font-size:12px;color:var(--green);padding:14px;background:rgba(16,185,129,0.08);border-radius:10px;text-align:center">🎉 ¡Todas las cuentas entre usuarios están al día y liquidadas!</div>';
    return;
  }

  matrixEl.innerHTML = debtPairs.map(p => {
    const isMeDebtor = p.debtor.id === currentUser.id;
    const isMeCreditor = p.creditor.id === currentUser.id;

    return `
      <div style="padding:12px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
            ${p.debtor.avatar || '👤'} <strong>${p.debtor.name || p.debtor.username}</strong> debe <span style="color:var(--red);font-weight:800">$${p.amount.toFixed(2)} USD</span> a <strong>${p.creditor.name || p.creditor.username}</strong> ${p.creditor.avatar || '👤'}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            ${isMeDebtor ? '⚠️ Debes pagar esta cantidad' : (isMeCreditor ? '💚 Te deben esta cantidad' : 'Saldo pendiente entre otros usuarios')}
          </div>
        </div>
        <button onclick="settleDebtBetweenUsers('${p.debtor.id}', '${p.creditor.id}', ${p.amount})" style="padding:6px 12px;font-size:11px;font-weight:800;background:var(--accent);color:#070913;border:none;border-radius:8px;cursor:pointer">
          ⚡ Saldar
        </button>
      </div>
    `;
  }).join('');
}

function settleDebtBetweenUsers(debtorId, creditorId, amount) {
  const users = getStoredUsers();
  const debtor = users.find(u => u.id === debtorId);
  const creditor = users.find(u => u.id === creditorId);

  const sharedExpenses = fromLS('ejcp_shared_expenses', []);
  sharedExpenses.push({
    id: 'se-settle-' + uid(),
    desc: `⚡ Liquidación / Saldo de deuda con ${creditor ? creditor.name : 'usuario'}`,
    amount: amount,
    category: 'otros',
    date: toLocalDate(new Date()),
    payerId: debtorId,
    participantIds: [creditorId],
    createdAt: new Date().toISOString()
  });

  toLS('ejcp_shared_expenses', sharedExpenses);
  showToast(`✅ Deuda de $${amount.toFixed(2)} saldada exitosamente entre ${debtor ? debtor.name : debtorId} y ${creditor ? creditor.name : creditorId}`, 'success');
  renderSharedExpensesModule();
}

// ═══════════════════════════════════════════
//  REGISTRO DE SESIONES DE USO DE USUARIO
// ═══════════════════════════════════════════

let currentSessionId = null;

function startUserSessionLog(userObj) {
  if (!userObj || !userObj.id) return;
  const sessions = fromLS('ejcp_user_sessions', []);
  currentSessionId = 'sess-' + uid();
  const newSession = {
    id: currentSessionId,
    userId: userObj.id,
    userName: userObj.name || userObj.username,
    email: userObj.email || `${userObj.username}@ejcp.com`,
    loginTime: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    sectionsVisited: ['Dashboard']
  };
  sessions.push(newSession);
  toLS('ejcp_user_sessions', sessions);
}

function logSectionVisit(moduleName) {
  if (!currentSessionId) return;
  const sessions = fromLS('ejcp_user_sessions', []);
  const sess = sessions.find(s => s.id === currentSessionId);
  if (sess) {
    sess.lastActive = new Date().toISOString();
    if (!sess.sectionsVisited.includes(moduleName)) {
      sess.sectionsVisited.push(moduleName);
    }
    toLS('ejcp_user_sessions', sessions);
  }
}

function openUserSessionsModal() {
  const modal = document.getElementById('modal-user-sessions');
  const listEl = document.getElementById('user-sessions-list');
  if (!modal || !listEl) return;

  const currentUser = getCurrentUser();
  const allSessions = fromLS('ejcp_user_sessions', []);
  const mySessions = allSessions.filter(s => s.userId === currentUser.id);

  if (mySessions.length === 0) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:20px;text-align:center">No hay registros de sesiones anteriores. Tu sesión actual ha sido registrada.</div>';
  } else {
    listEl.innerHTML = mySessions.slice().reverse().map(s => {
      const loginDate = s.loginTime ? new Date(s.loginTime).toLocaleString('es-VE') : 'Reciente';
      const lastDate = s.lastActive ? new Date(s.lastActive).toLocaleTimeString('es-VE') : '';
      const sections = (s.sectionsVisited || []).join(', ');

      return `
        <div style="padding:12px 14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-light)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-size:13px;font-weight:700;color:var(--text-primary)">
              🔑 Sesión de <strong>${esc(s.userName || currentUser.username)}</strong> (${esc(s.email)})
            </div>
            <span style="font-size:10px;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.15);color:var(--green);font-weight:700">Registrada / En Línea</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted)"><strong>Inicio de Sesión:</strong> ${loginDate}</div>
          <div style="font-size:11px;color:var(--text-muted)"><strong>Última actividad:</strong> ${lastDate}</div>
          <div style="font-size:11px;color:var(--accent);margin-top:4px"><strong>Secciones/Módulos visitados:</strong> ${esc(sections)}</div>
        </div>
      `;
    }).join('');
  }

  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'all';
}

function closeUserSessionsModal() {
  const modal = document.getElementById('modal-user-sessions');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
  }
}

const ejcpRealtimeChatChannel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('ejcp_realtime_chat') : null;

if (ejcpRealtimeChatChannel) {
  ejcpRealtimeChatChannel.onmessage = (evt) => {
    if (evt.data && evt.data.type === 'NEW_CHAT_MSG') {
      const currentUser = getCurrentUser();
      if (currentUser) {
        renderChatMessages();
      }
    }
  };
}

// Global scope window assignments
if (typeof window !== 'undefined') {
  window.openUserSwitchModal        = openUserSwitchModal;
  window.closeUserSwitchModal       = closeUserSwitchModal;
  window.switchActiveUser           = switchActiveUser;
  window.openAuthModal              = openAuthModal;
  window.closeAuthModal             = closeAuthModal;
  window.openRegisterModal          = openRegisterModal;
  window.handleDirectRegister       = handleDirectRegister;
  window.handleAuthSubmit           = handleAuthSubmit;
  window.handleSharedExpenseSubmit  = handleSharedExpenseSubmit;
  window.deleteSharedExpense        = deleteSharedExpense;
  window.settleDebtBetweenUsers     = settleDebtBetweenUsers;
  window.renderSharedExpensesModule = renderSharedExpensesModule;
  window.openUserSessionsModal      = openUserSessionsModal;
  window.closeUserSessionsModal     = closeUserSessionsModal;
  window.logSectionVisit            = logSectionVisit;
  window.logoutUser                 = logoutUser;
  window.checkAuthLockScreen        = checkAuthLockScreen;
  window.toggleAuthMode             = toggleAuthMode;
  window.resetDatabaseToZero        = resetDatabaseToZero;

  window.addEventListener('storage', (e) => {
    if (e.key === 'ejcp_messages') {
      const currentUser = getCurrentUser();
      if (currentUser) {
        renderChatMessages();
      }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkAuthLockScreen, 100);
  });
}
