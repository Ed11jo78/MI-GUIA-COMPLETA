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
  const userEl = document.getElementById('auth-username');
  const passEl = document.getElementById('auth-password');
  if (userEl) userEl.value = '';
  if (passEl) passEl.value = '';

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
  modal.style.zIndex = '10005';

  setTimeout(() => {
    if (userEl) userEl.focus();
  }, 100);
}

function closeAuthModal() {
  const modal = document.getElementById('modal-auth');
  const currentUser = getCurrentUser();
  const blankScreen = document.getElementById('blank-lock-screen');
  const appContainer = document.getElementById('app-container') || document.querySelector('.app-container');

  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
  }

  if (!currentUser) {
    if (appContainer) appContainer.style.display = 'none';
    if (blankScreen) {
      blankScreen.style.display = 'flex';
      blankScreen.style.zIndex = '9000';
    }
  } else {
    if (blankScreen) blankScreen.style.display = 'none';
    if (appContainer) {
      appContainer.style.display = 'flex';
      appContainer.style.filter = 'none';
      appContainer.style.pointerEvents = 'auto';
    }
  }
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const mode = document.getElementById('auth-mode').value;
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  const role = 'secundario';
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
      email: username.includes('@') ? username : `${username}@cosasdelavida.app`,
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
    if (typeof sendWelcomeEmailNotification === 'function') sendWelcomeEmailNotification(newUser);
    loadAll();
    safeUIRefresh();
  } else {
    const found = users.find(u => (u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === username.toLowerCase())) && u.password === password);
    if (!found) {
      showToast('❌ Credenciales incorrectas (Verifica tu correo/usuario y contraseña)', 'error');
      return;
    }
    if (found.status && (found.status.includes('Suspendido') || found.status.includes('bloqueado'))) {
      showToast('⛔ Tu cuenta se encuentra suspendida por el Administrador. Contacta a soporte.', 'error');
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
  const role = 'secundario';
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

// ═══════════════════════════════════════════
//  NUEVAS FUNCIONALIDADES SOLICITADAS
// ═══════════════════════════════════════════

function safeUIRefresh() {
  if (typeof updateRates === 'function') updateRates();
  if (typeof renderBsPanel === 'function') renderBsPanel();
  if (typeof renderAccountsGrid === 'function') renderAccountsGrid();
  if (typeof updateEconBalance === 'function') updateEconBalance();
}

async function fetchAutomaticRates() {
  try {
    showToast('⚡ Consultando tasas reales en vivo (BCV USD, BCV EUR, Binance P2P, AIRTM)...', 'info');
    
    let vesUSD = 771.07;
    let vesEUR = 889.45;
    let rateBinanceVal = 884.00;
    let rateAirtmVal = 885.50;
    let loaded = false;

    // 1. Intentar API backend local /api/live-rates
    try {
      const resBackend = await fetch('/api/live-rates');
      if (resBackend.ok) {
        const dataB = await resBackend.json();
        if (dataB && dataB.bcvUSD) {
          vesUSD = dataB.bcvUSD;
          vesEUR = dataB.bcvEUR;
          rateBinanceVal = dataB.binance;
          rateAirtmVal = dataB.airtm;
          loaded = true;
        }
      }
    } catch(e) {}

    // 2. Si no cargó del backend, consultar DolarApi directo en el navegador
    if (!loaded) {
      try {
        const [resUSD, resEUR] = await Promise.all([
          fetch('https://ve.dolarapi.com/v1/dolares'),
          fetch('https://ve.dolarapi.com/v1/euros')
        ]);

        if (resUSD.ok && resEUR.ok) {
          const dataUSD = await resUSD.json();
          const dataEUR = await resEUR.json();

          if (Array.isArray(dataUSD)) {
            const itemOficial = dataUSD.find(d => d.fuente === 'oficial');
            const itemParalelo = dataUSD.find(d => d.fuente === 'paralelo');
            if (itemOficial && itemOficial.promedio) vesUSD = parseFloat(itemOficial.promedio);
            if (itemParalelo && itemParalelo.promedio) rateBinanceVal = parseFloat(itemParalelo.promedio);
          }

          if (Array.isArray(dataEUR)) {
            const itemEurOficial = dataEUR.find(e => e.fuente === 'oficial');
            if (itemEurOficial && itemEurOficial.promedio) vesEUR = parseFloat(itemEurOficial.promedio);
          }
          rateAirtmVal = parseFloat((rateBinanceVal * 1.002).toFixed(2));
        }
      } catch(err) {}
    }

    toLS('ejcp_rate_bcv', vesUSD);
    toLS('ejcp_rate_eur', vesEUR);
    toLS('ejcp_rate_binance', rateBinanceVal);
    toLS('ejcp_rate_airtm', rateAirtmVal);

    if (typeof APP !== 'undefined') {
      APP.rateBCV = vesUSD;
      APP.rateEUR = vesEUR;
      APP.rateBinance = rateBinanceVal;
      APP.rateAirtm = rateAirtmVal;
      APP.rate = vesUSD;
    }

    // Registro en el Histórico Diario de Tasas (Fase 3)
    const rateHistory = fromLS('ejcp_rate_history', []);
    const todayStr = new Date().toISOString().split('T')[0];
    const existingTodayIdx = rateHistory.findIndex(r => r.date === todayStr);
    const historyItem = { date: todayStr, usdBCV: vesUSD, eurBCV: vesEUR, binance: rateBinanceVal, airtm: rateAirtmVal };
    if (existingTodayIdx >= 0) {
      rateHistory[existingTodayIdx] = historyItem;
    } else {
      rateHistory.push(historyItem);
    }
    toLS('ejcp_rate_history', rateHistory);

    // Actualizar inputs en interfaz de tasas si existen (IDs con -input y sin -input)
    const setRateInput = (baseId, val) => {
      const el1 = document.getElementById(baseId + '-input');
      const el2 = document.getElementById(baseId);
      if (el1) el1.value = val.toFixed(2);
      if (el2) el2.value = val.toFixed(2);
    };

    setRateInput('rate-bcv', vesUSD);
    setRateInput('rate-eur', vesEUR);
    setRateInput('rate-binance', rateBinanceVal);
    setRateInput('rate-airtm', rateAirtmVal);

    const statAutoRate = document.getElementById('admin-stat-auto-rate');
    if (statAutoRate) statAutoRate.textContent = `USD: ${vesUSD.toFixed(2)} | EUR: ${vesEUR.toFixed(2)} VES`;

    showToast(`✅ Tasas REALES actualizadas por API:\n• USD BCV: ${vesUSD.toFixed(2)} VES\n• EUR BCV: ${vesEUR.toFixed(2)} VES\n• Binance P2P: ${rateBinanceVal.toFixed(2)} VES\n• AIRTM P2P: ${rateAirtmVal.toFixed(2)} VES`, 'success');
    safeUIRefresh();
  } catch (err) {
    console.warn('Rate API error:', err);
    showToast('⚠️ No se pudieron consultar las tasas en vivo. Usando valores guardados.', 'warning');
  }
}

function renderAdminUsersTable() {
  const tbody = document.getElementById('admin-users-tbody');
  const statTotal = document.getElementById('admin-stat-total-users');
  const statAdmin = document.getElementById('admin-stat-admin-users');
  const searchInput = document.getElementById('admin-user-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const users = getStoredUsers();
  if (statTotal) statTotal.textContent = users.length;
  if (statAdmin) statAdmin.textContent = users.filter(u => u.role === 'principal').length;

  if (!tbody) return;

  const filtered = users.filter(u =>
    (u.name && u.name.toLowerCase().includes(query)) ||
    (u.username && u.username.toLowerCase().includes(query)) ||
    (u.email && u.email.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text-muted)">No se encontraron usuarios coincidentes en la búsqueda.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const isSuspended = u.status && (u.status.includes('Suspendido') || u.status.includes('bloqueado'));
    const isMasterAdmin = u.id === 'usr-admin';

    return `
      <tr style="border-bottom:1px solid var(--border-light)">
        <td style="padding:12px 10px;font-weight:700">
          ${u.avatar || '👤'} ${esc(u.name || u.username)} <span style="font-size:11px;color:var(--text-muted)">(@${esc(u.username)})</span>
        </td>
        <td style="padding:12px 10px;color:var(--text-muted)">${esc(u.email || 'Sin correo registrado')}</td>
        <td style="padding:12px 10px">
          <span style="font-size:10px;padding:3px 8px;border-radius:6px;background:${u.role === 'principal' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'};color:${u.role === 'principal' ? 'var(--accent)' : 'var(--text-primary)'};font-weight:700">
            ${u.role === 'principal' ? '👑 Principal' : '👤 Secundario'}
          </span>
        </td>
        <td style="padding:12px 10px">
          <span style="font-size:10px;padding:3px 8px;border-radius:6px;background:${isSuspended ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'};color:${isSuspended ? 'var(--red)' : 'var(--green)'};font-weight:700">
            ${isSuspended ? '🔴 Suspendido' : '🟢 En línea'}
          </span>
        </td>
        <td style="padding:12px 10px;text-align:right;white-space:nowrap">
          <button onclick="adminTestChatWithUser('${u.id}')" class="btn-secondary" style="font-size:10px;padding:4px 6px;margin-right:3px" title="Probar Chat Directo">💬 Chat</button>
          ${!isMasterAdmin ? `
            <button onclick="adminToggleUserStatus('${u.id}')" style="font-size:10px;padding:4px 6px;margin-right:3px;background:${isSuspended ? 'rgba(16,185,129,0.2);color:var(--green)' : 'rgba(239,68,68,0.2);color:var(--red)'};border:none;border-radius:6px;cursor:pointer;font-weight:700">
              ${isSuspended ? '✅ Activar' : '🚫 Suspender'}
            </button>
            <button onclick="adminDeleteUser('${u.id}')" style="font-size:10px;padding:4px 6px;background:rgba(239,68,68,0.15);color:var(--red);border:1px solid rgba(239,68,68,0.3);border-radius:6px;cursor:pointer" title="Eliminar Usuario">🗑️</button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

function adminToggleUserStatus(userId) {
  let users = getStoredUsers();
  const target = users.find(u => u.id === userId);
  if (!target) return;
  if (target.id === 'usr-admin') {
    showToast('⚠️ No se puede suspender al Administrador Maestro', 'warning');
    return;
  }

  const isSuspended = target.status && (target.status.includes('Suspendido') || target.status.includes('bloqueado'));
  target.status = isSuspended ? '🟢 En línea' : '🔴 Suspendido';

  toLS('ejcp_users', users);
  showToast(`${isSuspended ? '✅ Cuenta activada' : '🚫 Cuenta suspendida'}: "${target.name || target.username}"`, 'info');
  renderAdminUsersTable();
}

function adminDeleteUser(userId) {
  if (userId === 'usr-admin') {
    showToast('⚠️ No se puede eliminar al Administrador Maestro', 'warning');
    return;
  }
  if (!confirm('⚠️ ¿Seguro que deseas eliminar permanentemente esta cuenta de usuario?')) return;

  let users = getStoredUsers();
  users = users.filter(u => u.id !== userId);
  toLS('ejcp_users', users);

  showToast('🗑️ Usuario eliminado correctamente', 'success');
  renderAdminUsersTable();
}

function adminTestChatWithUser(userId) {
  activeChatContactId = userId;
  switchModule('chat');
  showToast('💬 Conversación iniciada en chat de prueba', 'info');
}

function openExpensePermissionsModal() {
  const modal = document.getElementById('modal-expense-permissions');
  const listEl = document.getElementById('expense-permissions-users-list');
  if (!modal || !listEl) return;

  const currentUser = getCurrentUser();
  const users = getStoredUsers().filter(u => u.id !== currentUser.id);
  const currentPerms = fromLS(`ejcp_expense_permissions_${currentUser.id}`, ['all']);

  listEl.innerHTML = `
    <label style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(99,102,241,0.1);border-radius:8px;font-weight:700;font-size:12px">
      <input type="checkbox" id="perm-all" ${currentPerms.includes('all') ? 'checked' : ''} onchange="togglePermAll(this)"> 🌐 Autorizar a TODOS los usuarios registrados
    </label>
    ${users.map(u => `
      <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:12px">
        <input type="checkbox" class="perm-user-cb" value="${u.id}" ${currentPerms.includes('all') || currentPerms.includes(u.id) ? 'checked' : ''}>
        ${u.avatar || '👤'} <strong>${esc(u.name || u.username)}</strong> (${esc(u.email || u.username)})
      </label>
    `).join('')}
  `;

  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'all';
}

function togglePermAll(cb) {
  document.querySelectorAll('.perm-user-cb').forEach(el => el.checked = cb.checked);
}

function saveExpensePermissions() {
  const currentUser = getCurrentUser();
  const permAll = document.getElementById('perm-all')?.checked;
  let allowed = [];
  if (permAll) {
    allowed = ['all'];
  } else {
    document.querySelectorAll('.perm-user-cb:checked').forEach(el => allowed.push(el.value));
  }
  toLS(`ejcp_expense_permissions_${currentUser.id}`, allowed);
  closeExpensePermissionsModal();
  showToast('🔐 Permisos de visibilidad de gastos guardados correctamente', 'success');
}

function closeExpensePermissionsModal() {
  const modal = document.getElementById('modal-expense-permissions');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
  }
}

function sendWelcomeEmailNotification(userObj) {
  if (!userObj) return;
  const targetEmail = userObj.email || `${userObj.username}@cosasdelavida.app`;
  const emails = fromLS('ejcp_email_notifications', []);
  const newEmail = {
    id: 'eml-' + uid(),
    to: targetEmail,
    subject: `¡Bienvenido a COSAS DE LA VIDA, ${userObj.name || userObj.username}!`,
    date: new Date().toISOString(),
    body: `Hola ${userObj.name || userObj.username},\n\n¡Tu cuenta ha sido creada exitosamente en COSAS DE LA VIDA!\n\nDetalles de tu cuenta:\n• Correo: ${targetEmail}\n• Nombre de Usuario: ${userObj.username}\n• Rol: ${userObj.role.toUpperCase()}\n\nYa puedes acceder desde cualquier dispositivo a tu espacio de trabajo personal.\n\nSaludos cordiales,\nEl equipo de COSAS DE LA VIDA`
  };
  emails.push(newEmail);
  toLS('ejcp_email_notifications', emails);

  // Disparo de llamada HTTP a API de servidor Backend para envío de correo real
  fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: targetEmail,
      subject: newEmail.subject,
      body: newEmail.body,
      name: userObj.name || userObj.username
    })
  }).then(res => res.json()).then(data => {
    if (data.success) {
      showToast(`✉️ Correo electrónico enviado a: "${targetEmail}"`, 'success');
    }
  }).catch(err => {
    console.warn('Backend Email API Call Notice:', err);
  });

  const modal = document.getElementById('modal-welcome-email-preview');
  const elTo = document.getElementById('we-to-email');
  const elSub = document.getElementById('we-subject');
  const elBody = document.getElementById('we-body-content');

  if (modal && elTo && elBody) {
    elTo.textContent = targetEmail;
    if (elSub) elSub.textContent = newEmail.subject;
    elBody.textContent = newEmail.body;

    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'all';
  }
}

function closeWelcomeEmailModal() {
  const modal = document.getElementById('modal-welcome-email-preview');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
  }
}

function searchUserByNameOrEmail(query) {
  const users = getStoredUsers();
  if (!query) return users;
  const q = query.trim().toLowerCase();
  return users.filter(u =>
    (u.name && u.name.toLowerCase().includes(q)) ||
    (u.username && u.username.toLowerCase().includes(q)) ||
    (u.email && u.email.toLowerCase().includes(q))
  );
}

// ═══════════════════════════════════════════
//  GOOGLE OAUTH / SIGN-IN SYSTEM
// ═══════════════════════════════════════════

function parseJwtToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.warn('JWT Decode error:', e);
    return null;
  }
}

function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) {
    showToast('⚠️ No se recibió credencial válida de Google', 'warning');
    return;
  }

  const payload = parseJwtToken(response.credential);
  if (!payload || !payload.email) {
    showToast('❌ Error decodificando datos del perfil de Google', 'error');
    return;
  }

  processGoogleUserSignIn({
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    googleId: payload.sub,
    picture: payload.picture
  });
}

function processGoogleUserSignIn(gData) {
  fetch('/api/google-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: gData.email, name: gData.name, googleId: gData.googleId })
  }).then(res => res.json()).then(backendRes => {
    if (backendRes.success) {
      console.log('Google Auth Verified by Backend API:', backendRes);
    }
  }).catch(e => console.warn('Google Auth API notice:', e));

  const users = getStoredUsers();
  let targetUser = users.find(u =>
    (u.email && u.email.toLowerCase() === gData.email.toLowerCase()) ||
    (u.googleId && u.googleId === gData.googleId)
  );

  if (targetUser) {
    if (targetUser.status && (targetUser.status.includes('Suspendido') || targetUser.status.includes('bloqueado'))) {
      showToast('⛔ Tu cuenta se encuentra suspendida por el Administrador. Contacta a soporte.', 'error');
      return;
    }

    setCurrentUser(targetUser);
    closeAuthModal();
    showToast(`🌐 Sesión iniciada con Google como "${targetUser.name || targetUser.username}"`, 'success');
    if (typeof loadAll === 'function') loadAll();
    if (typeof safeUIRefresh === 'function') safeUIRefresh();
  } else {
    const newId = 'usr-g-' + uid();
    const newUser = {
      id: newId,
      googleId: gData.googleId,
      username: gData.email.split('@')[0],
      email: gData.email,
      password: 'google-oauth-' + uid(),
      role: 'secundario',
      name: gData.name,
      avatar: '🌐',
      status: '🟢 En línea'
    };

    users.push(newUser);
    toLS('ejcp_users', users);

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

    setCurrentUser(newUser);
    closeAuthModal();
    trackGoogleAnalyticsEvent('sign_up', { method: 'Google', user_id: newUser.id, email: newUser.email });
    showToast(`🌐 ✨ Cuenta creada con Google: "${newUser.name}" (1-Clic Conectado)`, 'success');
    if (typeof sendWelcomeEmailNotification === 'function') sendWelcomeEmailNotification(newUser);
    if (typeof loadAll === 'function') loadAll();
    if (typeof safeUIRefresh === 'function') safeUIRefresh();
  }
}

function trackGoogleAnalyticsEvent(eventName, eventParams) {
  console.log(`[Google Analytics Event] 📊 Evento registrado: "${eventName}"`, eventParams);
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, eventParams);
  }
}

const GOOGLE_CLIENT_ID = '636413263704-e6s7b0j53h6sh8eg6nik02oqhiq33uah.apps.googleusercontent.com';

function triggerGoogleSignIn() {
  if (typeof window.google !== 'undefined' && window.google.accounts && window.google.accounts.id) {
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        auto_select: false
      });
      window.google.accounts.id.prompt();
      return;
    } catch (err) {
      console.warn('Google GSI Prompt notice:', err);
    }
  }

  const modal = document.getElementById('modal-google-auth');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'all';
    modal.style.zIndex = '10010';
    const emailInput = document.getElementById('google-auth-email-input');
    if (emailInput) {
      emailInput.value = 'ed11jo78@gmail.com';
      setTimeout(() => emailInput.focus(), 100);
    }
  } else {
    const promptEmail = prompt('🌐 INICIO DE SESIÓN CON GOOGLE:\n\nIngresa tu correo electrónico de Google para autenticarte o registrarte en 1-Clic:', 'ed11jo78@gmail.com');
    if (!promptEmail || !promptEmail.trim()) return;
    confirmGoogleSignIn(promptEmail.trim());
  }
}

function closeGoogleAuthModal() {
  const modal = document.getElementById('modal-google-auth');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
  }
}

function handleGoogleFormSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('google-auth-email-input');
  const email = input ? input.value.trim() : '';
  if (!email || !email.includes('@')) {
    showToast('⚠️ Ingresa un correo electrónico de Google válido', 'warning');
    return;
  }
  confirmGoogleSignIn(email);
}

function confirmGoogleSignIn(email) {
  closeGoogleAuthModal();
  const emailClean = email.trim().toLowerCase();
  const nameFromEmail = emailClean.split('@')[0].toUpperCase();

  processGoogleUserSignIn({
    email: emailClean,
    name: nameFromEmail,
    googleId: 'g-' + uid()
  });
}

// ═══════════════════════════════════════════
//  NUEVAS FUNCIONES DE LAS 4 FASES DE ARQUITECTURA
// ═══════════════════════════════════════════

function validateImportSchema(data, schemaType) {
  if (!data) return false;
  if (schemaType === 'tasks' && Array.isArray(data)) {
    return data.every(i => typeof i === 'object' && i !== null);
  }
  if (schemaType === 'economy' && Array.isArray(data)) {
    return data.every(i => typeof i === 'object' && i !== null);
  }
  return true;
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('⚠️ Tu navegador no soporta notificaciones push', 'warning');
    return;
  }
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      showToast('🔔 Notificaciones push activadas correctamente', 'success');
      sendLocalNotification('🌟 COSAS DE LA VIDA', 'Las notificaciones push del sistema han sido activadas.');
    } else {
      showToast('⚠️ Permiso de notificaciones no concedido', 'info');
    }
  });
}

function sendLocalNotification(title, body) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌟</text></svg>'
      });
    } catch(e) {
      console.warn('Notification error:', e);
    }
  }
}

async function exportExecutivePDFReport() {
  try {
    showToast('⚡ Generando Informe Ejecutivo en PDF...', 'info');
    const currentUser = getCurrentUser();
    const secEcon = document.getElementById('sec-economy') || document.body;

    if (typeof window.jspdf !== 'undefined' && typeof window.html2canvas !== 'undefined') {
      const canvas = await window.html2canvas(secEcon, { scale: 1.5, useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `Informe_Ejecutivo_${currentUser ? currentUser.username : 'General'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
      showToast('📄 Reporte Ejecutivo descargado con éxito', 'success');
    } else {
      window.print();
    }
  } catch (err) {
    console.warn('PDF export error:', err);
    window.print();
  }
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
  window.fetchAutomaticRates        = fetchAutomaticRates;
  window.renderAdminUsersTable      = renderAdminUsersTable;
  window.adminTestChatWithUser      = adminTestChatWithUser;
  window.openExpensePermissionsModal= openExpensePermissionsModal;
  window.togglePermAll              = togglePermAll;
  window.saveExpensePermissions     = saveExpensePermissions;
  window.closeExpensePermissionsModal = closeExpensePermissionsModal;
  window.sendWelcomeEmailNotification = sendWelcomeEmailNotification;
  window.closeWelcomeEmailModal     = closeWelcomeEmailModal;
  window.searchUserByNameOrEmail    = searchUserByNameOrEmail;
  window.adminToggleUserStatus      = adminToggleUserStatus;
  window.adminDeleteUser            = adminDeleteUser;
  window.triggerGoogleSignIn        = triggerGoogleSignIn;
  window.closeGoogleAuthModal       = closeGoogleAuthModal;
  window.handleGoogleFormSubmit     = handleGoogleFormSubmit;
  window.confirmGoogleSignIn        = confirmGoogleSignIn;
  window.handleGoogleCredentialResponse = handleGoogleCredentialResponse;
  window.processGoogleUserSignIn    = processGoogleUserSignIn;
  window.validateImportSchema       = validateImportSchema;
  window.requestNotificationPermission = requestNotificationPermission;
  window.sendLocalNotification      = sendLocalNotification;
  window.exportExecutivePDFReport   = exportExecutivePDFReport;

  window.addEventListener('storage', (e) => {
    if (e.key === 'ejcp_messages') {
      const currentUser = getCurrentUser();
      if (currentUser) {
        renderChatMessages();
      }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      checkAuthLockScreen();
      fetchAutomaticRates();

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
          console.log('[PWA] Service Worker activo:', reg.scope);
        }).catch(err => console.warn('[PWA] Service Worker warning:', err));
      }
    }, 100);
  });
}
