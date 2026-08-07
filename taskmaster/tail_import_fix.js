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
  const curAccs = fromLS('ejcp_accounts', {
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

  const econ = fromLS('ejcp_economy', []);
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

  toLS('ejcp_accounts', accs);
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

  const { from, to } = getExportDateFilter();
  const rangeLabel = (from || to)
    ? ` (${from ? from.toLocaleDateString('es-VE') : '...'} → ${to ? to.toLocaleDateString('es-VE') : '...'})`
    : ' (Completo)';

  const wb = XLSX.utils.book_new();

  // 1. Configuración & Perfil General con Saldos Iniciales de Cuentas
  const profile = fromLS('taskmaster_profile', {});
  const accs    = fromLS('ejcp_accounts', {});

  const configData = [{
    Usuario:         profile.name     || 'Edwin José Colmenares Pacheco',
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
  const taskRaw  = applyDateFilter(fromLS('ejcp_tasks', []), 'date');
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
  const ticketRaw  = applyDateFilter(fromLS('ejcp_tickets', []).map(tk => ({ ...tk, date: tk.createdAt || tk.date })), 'date');
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
  const netRaw  = applyDateFilter(fromLS('ejcp_network', []), 'date');
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
  const econRaw  = applyDateFilter(fromLS('ejcp_economy', []), 'date');
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
  const debtList = fromLS('ejcp_debts', []);
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
  const actRaw  = applyDateFilter(fromLS('ejcp_activities', []), 'date');
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
  const { from, to } = getExportDateFilter();

  const fullBackup = {
    exportMeta: {
      generatedAt: new Date().toISOString(),
      rangeFrom:   from ? from.toISOString() : null,
      rangeTo:     to   ? to.toISOString()   : null,
      version:     '3.0'
    },
    profile:          fromLS('taskmaster_profile', {}),
    rate:             APP.rateBCV || 755.90,
    rates: {
      bcv:            APP.rateBCV || 755.90,
      eur:            APP.rateEUR || 755.90,
      binance:        APP.rateBinance || 755.90,
      airtm:          APP.rateAirtm || 755.90
    },
    accounts:         fromLS('ejcp_accounts', {}),
    econTransactions: applyDateFilter(fromLS('ejcp_economy', []),  'date'),
    economy:          applyDateFilter(fromLS('ejcp_economy', []),  'date'),
    tasks:            applyDateFilter(fromLS('ejcp_tasks',   []),  'date'),
    tickets:          applyDateFilter(fromLS('ejcp_tickets', []).map(tk => ({ ...tk, date: tk.createdAt || tk.date })), 'date'),
    networkEvents:    applyDateFilter(fromLS('ejcp_network', []),  'date'),
    network:          applyDateFilter(fromLS('ejcp_network', []),  'date'),
    debts:            fromLS('ejcp_debts', []),
    activities:       applyDateFilter(fromLS('ejcp_activities', []), 'date'),
    portfolio:        getAutoPortfolio()
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

  const mode     = document.querySelector('input[name="importMode"]:checked')?.value || 'overwrite';
  const fileName = file.name.toLowerCase();
  const reader   = new FileReader();

  // Snapshot para ROLLBACK transaccional
  const snapshot = {
    tasks:      JSON.parse(JSON.stringify(fromLS('ejcp_tasks', []))),
    tickets:    JSON.parse(JSON.stringify(fromLS('ejcp_tickets', []))),
    network:    JSON.parse(JSON.stringify(fromLS('ejcp_network', []))),
    economy:    JSON.parse(JSON.stringify(fromLS('ejcp_economy', []))),
    debts:      JSON.parse(JSON.stringify(fromLS('ejcp_debts', []))),
    activities: JSON.parse(JSON.stringify(fromLS('ejcp_activities', []))),
    accounts:   JSON.parse(JSON.stringify(fromLS('ejcp_accounts', {}))),
    rateBCV:    APP.rateBCV,
    rateBinance:APP.rateBinance,
    rateAirtm:  APP.rateAirtm
  };

  const rollback = (errMsg) => {
    toLS('ejcp_tasks',      snapshot.tasks);
    toLS('ejcp_tickets',    snapshot.tickets);
    toLS('ejcp_network',    snapshot.network);
    toLS('ejcp_economy',    snapshot.economy);
    toLS('ejcp_debts',      snapshot.debts);
    toLS('ejcp_activities', snapshot.activities);
    toLS('ejcp_accounts',   snapshot.accounts);
    if (snapshot.rateBCV) toLS('ejcp_rate_bcv', snapshot.rateBCV);
    loadAll();
    showToast('❌ Error en importación: Transacción abortada. ' + errMsg, 'error');
  };

  if (fileName.endsWith('.json')) {
    reader.onload = function(e) {
      try {
        const json = JSON.parse(e.target.result);
        localStorage.removeItem('ejcp_cleared');

        // Tasa Global
        if (json.rate || json.rates) {
          const globalRate = json.rate || (json.rates && json.rates.bcv) || 755.9;
          APP.rateBCV = globalRate; APP.rateBinance = globalRate; APP.rateAirtm = globalRate; APP.rate = globalRate;
          toLS('ejcp_rate_bcv', globalRate);
          toLS('ejcp_rate_binance', globalRate);
          toLS('ejcp_rate_airtm', globalRate);
        }

        if (json.accounts)  toLS('ejcp_accounts', json.accounts);
        if (json.profile)   toLS('taskmaster_profile', json.profile);
        if (json.portfolio) saveAutoPortfolio(json.portfolio);

        const jsonTasks      = json.tasks || json.taskList || null;
        const jsonEcon       = json.econTransactions || json.economy || json.transactions || null;
        const jsonDebts      = json.debts || json.debtList || null;
        const jsonTickets    = json.tickets || json.ticketList || null;
        const jsonNet        = json.networkEvents || json.network || json.networkList || null;
        const jsonActivities = json.activities || json.activitiesEvents || json.activityList || null;

        if (mode === 'overwrite') {
          if (jsonTasks !== null)      toLS('ejcp_tasks',      jsonTasks);
          if (jsonEcon !== null)       toLS('ejcp_economy',    jsonEcon);
          if (jsonDebts !== null)      toLS('ejcp_debts',      jsonDebts);
          if (jsonTickets !== null)    toLS('ejcp_tickets',    jsonTickets);
          if (jsonNet !== null)        toLS('ejcp_network',    jsonNet);
          if (jsonActivities !== null) toLS('ejcp_activities', jsonActivities);
        } else {
          if (jsonTasks)      toLS('ejcp_tasks',      upsertById(fromLS('ejcp_tasks',      []), jsonTasks));
          if (jsonEcon)       toLS('ejcp_economy',    upsertById(fromLS('ejcp_economy',    []), jsonEcon));
          if (jsonDebts)      toLS('ejcp_debts',      upsertById(fromLS('ejcp_debts',      []), jsonDebts));
          if (jsonTickets)    toLS('ejcp_tickets',    upsertById(fromLS('ejcp_tickets',    []), jsonTickets));
          if (jsonNet)        toLS('ejcp_network',    upsertById(fromLS('ejcp_network',    []), jsonNet));
          if (jsonActivities) toLS('ejcp_activities', upsertById(fromLS('ejcp_activities', []), jsonActivities));
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

        localStorage.removeItem('ejcp_cleared');

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

            const curAccs = fromLS('ejcp_accounts', {});
            if (!isNaN(sBin) && curAccs.binance)   curAccs.binance.baseBalance   = sBin;
            if (!isNaN(sAir) && curAccs.airtm)     curAccs.airtm.baseBalance     = sAir;
            if (!isNaN(sZin) && curAccs.zinli)     curAccs.zinli.baseBalance     = sZin;
            if (!isNaN(sVes) && curAccs.bolivares) curAccs.bolivares.baseBalance = sVes;
            if (!isNaN(sEfe) && curAccs.efectivo)  curAccs.efectivo.baseBalance  = sEfe;
            toLS('ejcp_accounts', curAccs);
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
          if (foundSheets.tasks)      toLS('ejcp_tasks',      newTasks);
          if (foundSheets.tickets)    toLS('ejcp_tickets',    newTickets);
          if (foundSheets.network)    toLS('ejcp_network',    newNetwork);
          if (foundSheets.economy)    toLS('ejcp_economy',    newEconomy);
          if (foundSheets.debts)      toLS('ejcp_debts',      newDebts);
          if (foundSheets.activities) toLS('ejcp_activities', newActivities);
        } else {
          if (newTasks.length)      toLS('ejcp_tasks',      upsertById(fromLS('ejcp_tasks',      []), newTasks));
          if (newTickets.length)    toLS('ejcp_tickets',    upsertById(fromLS('ejcp_tickets',    []), newTickets));
          if (newNetwork.length)    toLS('ejcp_network',    upsertById(fromLS('ejcp_network',    []), newNetwork));
          if (newEconomy.length)    toLS('ejcp_economy',    upsertById(fromLS('ejcp_economy',    []), newEconomy));
          if (newDebts.length)      toLS('ejcp_debts',      upsertById(fromLS('ejcp_debts',      []), newDebts));
          if (newActivities.length) toLS('ejcp_activities', upsertById(fromLS('ejcp_activities', []), newActivities));
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

  const resetAccounts = {
    binance:   { name: 'Binance',   cur: 'USDT', emoji: '🟡', balance: 0, baseBalance: 0 },
    airtm:     { name: 'AIRTM',    cur: 'USD',  emoji: '💙', balance: 0, baseBalance: 0 },
    zinli:     { name: 'Zinli',    cur: 'USD',  emoji: '🟣', balance: 0, baseBalance: 0 },
    bolivares: { name: 'Bolívares', cur: 'VES',  emoji: '🇻🇪', balance: 0, baseBalance: 0 },
    efectivo:  { name: 'Efectivo', cur: 'USD',  emoji: '💵', balance: 0, baseBalance: 0 }
  };
  toLS('ejcp_accounts', resetAccounts);

  toLS('ejcp_economy', []);
  toLS('ejcp_tasks', []);
  toLS('ejcp_tickets', []);
  toLS('ejcp_network', []);
  toLS('ejcp_debts', []);
  toLS('ejcp_activities', []);
  toLS('ejcp_cleared', true);

  toLS('ejcp_tk_cnt', 1);
  toLS('ejcp_net_cnt', 1);

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
  localStorage.removeItem('ejcp_cleared');

  const globalRate = 755.90;
  toLS('ejcp_rate_bcv', globalRate);
  toLS('ejcp_rate_binance', globalRate);
  toLS('ejcp_rate_airtm', globalRate);
  APP.rateBCV = globalRate; APP.rateBinance = globalRate; APP.rateAirtm = globalRate; APP.rate = globalRate;

  const txs = [
    { id: 'tx-1', type: 'ingreso', amount: 350.00, amountVes: 264565.00, rate: 755.90, origin: 'Binance', dest: 'Binance', account: 'Binance', desc: 'Pago por Proyecto Web Vettal', date: toLocalDate(new Date()) },
    { id: 'tx-2', type: 'egreso', amount: 80.00, amountVes: 60472.00, rate: 755.90, origin: 'Bolívares', dest: 'Bolívares', account: 'Bolívares', desc: 'Compra de Repuestos de Red', date: toLocalDate(new Date()) }
  ];
  toLS('ejcp_economy', txs);

  const debts = [
    { id: 'd-1', creditor: 'Préstamo Equipos de Red Cisco', name: 'Préstamo Equipos de Red Cisco', initialAmount: 200.00, originalAmount: 200.00, remainingAmount: 150.00, amount: 150.00, totalPaidVes: 37795.00, date: toLocalDate(new Date()), status: 'pendiente', payments: [{ id: 'p-1', date: toLocalDate(new Date()), vesAmount: 37795.00, rate: 755.90, usdAmount: 50.00 }] }
  ];
  toLS('ejcp_debts', debts);

  const tasks = [
    { id: 'tk-1', title: 'Auditar servidor pfSense ALTECEL', desc: 'Pruebas del sistema Vettal', category: 'it', priority: 'alta', done: false, date: toLocalDate(new Date()), tags: ['vettal','pfsense'] },
    { id: 'tk-2', title: 'Generar backup mensual en Excel', desc: 'Carga masiva de 4 pestañas', category: 'general', priority: 'media', done: true, date: toLocalDate(new Date()), tags: ['backup','excel'] }
  ];
  toLS('ejcp_tasks', tasks);

  const tickets = [
    { id: 'tck-1', number: 'TICK-1001', title: 'Falla enlace principal Inter Fibra Guatire', desc: 'Falla enlace principal Inter Fibra Guatire', status: 'cerrado', priority: 'alta', assignee: 'EDWIN COLMENARES', provider: 'Inter Fibra', solution: 'Reemplazo de conector óptico', category: 'red', date: toLocalDate(new Date()), timeOpen: '09:00', timeClose: '11:30', createdAt: toLocalDate(new Date()) }
  ];
  toLS('ejcp_tickets', tickets);

  const network = [
    { id: 'net-1', netId: 'NET-001', title: 'Corte de fibra óptica Guatire', description: 'Corte de fibra óptica Guatire', isp: 'Inter Fibra', duration: '2h 30m', startDate: new Date().toISOString(), endDate: new Date().toISOString(), type: 'total', status: 'resuelta', area: 'Guatire', cause: 'ISP', reportTo: 'Soporte ISP' }
  ];
  toLS('ejcp_network', network);

  syncAccountBalancesFromEconomy();

  showToast('⚡ ¡Datos de demostración cargados y sincronizados a tasa 755.9!', 'success');
  loadAll();
  safeUIRefresh();
  setTimeout(() => location.reload(), 800);
}
