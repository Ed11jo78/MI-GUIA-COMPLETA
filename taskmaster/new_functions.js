
// ═══════════════════════════════════════════
//  PLANTILLA DE IMPORTACIÓN VACÍA
// ═══════════════════════════════════════════

function downloadImportTemplate() {
  if (typeof XLSX === 'undefined') {
    showToast('⚠️ Cargando motor Excel (SheetJS), reintenta en un momento...', 'warning');
    return;
  }

  const wb = XLSX.utils.book_new();

  // 1. Instrucciones (primera pestaña)
  const instrSheet = XLSX.utils.aoa_to_sheet([
    ['📌 INSTRUCCIONES DE USO — Plantilla de Importación EJCP TaskMaster v3.0'],
    [''],
    ['PASO 1:', 'Abre este archivo en Microsoft Excel o Google Sheets.'],
    ['PASO 2:', 'Ve a la hoja (pestaña) que deseas completar. Cada hoja = una sección del sistema.'],
    ['PASO 3:', 'Rellena los datos desde la FILA 3 hacia abajo. La fila 2 tiene encabezados, la fila 3 es un ejemplo reemplazable.'],
    ['PASO 4:', 'La columna "ID" puede dejarse vacía — el sistema genera un ID único automáticamente.'],
    ['PASO 5:', 'Guarda el archivo como .xlsx y súbelo en: Base de Datos General → Importar.'],
    [''],
    ['REGLA 1:', 'NO cambies el nombre de las hojas/pestañas. El sistema las reconoce por nombre exacto.'],
    ['REGLA 2:', 'Las fechas SIEMPRE en formato YYYY-MM-DD (ejemplo: 2026-08-07).'],
    ['REGLA 3:', 'Modo Upsert: si un ID ya existe actualiza ese registro; si no existe lo agrega nuevo.'],
    [''],
    ['HOJAS DISPONIBLES:'],
    ['  Cuentas_y_Economia',    '→ Transacciones financieras (ingresos, egresos, traslados)'],
    ['  Deudas_y_Abonos',       '→ Control de acreedores y pagos en bolívares'],
    ['  Tareas_y_Pendientes',   '→ Tareas personales y profesionales'],
    ['  Tickets_Soporte_IT',    '→ Incidencias y tickets de soporte TI'],
    ['  Caidas_de_Red',         '→ Incidentes de conectividad ISP'],
    ['  Configuracion_y_Perfil','→ Datos del perfil y tasas de cambio'],
    [''],
    ['Generado:', new Date().toLocaleString('es-VE')],
    ['Sistema:',  'EJCP TaskMaster — Edwin José Colmenares Pacheco']
  ]);
  instrSheet['!cols'] = [{ wch: 30 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, instrSheet, '\uD83D\uDCCC Instrucciones');

  // 2. Cuentas_y_Economia
  const econSheet = XLSX.utils.aoa_to_sheet([
    ['\uD83D\uDCB0 SECCIÓN: Cuentas_y_Economia — Una fila por movimiento. Tipo: ingreso / egreso / traslado / pago_movil / zinli'],
    ['ID',           'Tipo',     'Monto_USD', 'Monto_VES', 'Tasa_Aplicada', 'Cuenta_Origen', 'Cuenta_Destino', 'Descripcion',                  'Fecha'],
    ['(vacío=auto)', 'ingreso',  350.00,      13370.00,    38.20,           'Binance',        'AIRTM',          'Ejemplo — borrar esta fila',    '2026-08-07'],
    ['(vacío=auto)', '',         '',          '',          '',              '',               '',               '',                              ''],
    ['(vacío=auto)', '',         '',          '',          '',              '',               '',               '',                              ''],
    ['(vacío=auto)', '',         '',          '',          '',              '',               '',               '',                              ''],
    ['(vacío=auto)', '',         '',          '',          '',              '',               '',               '',                              '']
  ]);
  econSheet['!cols'] = [{wch:14},{wch:12},{wch:11},{wch:11},{wch:14},{wch:14},{wch:16},{wch:40},{wch:12}];
  XLSX.utils.book_append_sheet(wb, econSheet, 'Cuentas_y_Economia');

  // 3. Deudas_y_Abonos
  const debtSheet = XLSX.utils.aoa_to_sheet([
    ['\uD83D\uDD34 SECCIÓN: Deudas_y_Abonos — Una fila por acreedor. Estado: pendiente / pagada'],
    ['ID',           'Acreedor',                    'Monto_Inicial_USD', 'Monto_Restante_USD', 'Total_Pagado_VES', 'Fecha_Registro', 'Estado'],
    ['(vacío=auto)', 'Ejemplo deuda — borrar fila', 200.00,             150.00,               1825.00,            '2026-08-07',     'pendiente'],
    ['(vacío=auto)', '',                            '',                 '',                   '',                 '',              ''],
    ['(vacío=auto)', '',                            '',                 '',                   '',                 '',              ''],
    ['(vacío=auto)', '',                            '',                 '',                   '',                 '',              '']
  ]);
  debtSheet['!cols'] = [{wch:14},{wch:34},{wch:18},{wch:20},{wch:18},{wch:15},{wch:14}];
  XLSX.utils.book_append_sheet(wb, debtSheet, 'Deudas_y_Abonos');

  // 4. Tareas_y_Pendientes
  const taskSheet = XLSX.utils.aoa_to_sheet([
    ['\uD83D\uDCCB SECCIÓN: Tareas_y_Pendientes — Prioridad: alta / media / baja. Completada: SI / NO. Categoria: general / it / salud / hogar'],
    ['ID',           'Titulo',                       'Categoria', 'Prioridad', 'Completada', 'Fecha'],
    ['(vacío=auto)', 'Ejemplo tarea — borrar fila',  'it',        'alta',      'NO',         '2026-08-07'],
    ['(vacío=auto)', '',                             '',          '',          '',           ''],
    ['(vacío=auto)', '',                             '',          '',          '',           ''],
    ['(vacío=auto)', '',                             '',          '',          '',           ''],
    ['(vacío=auto)', '',                             '',          '',          '',           '']
  ]);
  taskSheet['!cols'] = [{wch:14},{wch:44},{wch:18},{wch:12},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, taskSheet, 'Tareas_y_Pendientes');

  // 5. Tickets_Soporte_IT
  const ticketSheet = XLSX.utils.aoa_to_sheet([
    ['\uD83C\uDFAB SECCIÓN: Tickets_Soporte_IT — Estado: abierto / en_progreso / cerrado / escalado'],
    ['ID',           'Titulo',                        'Estado',   'Prioridad', 'Asignado',          'Fecha_Creacion'],
    ['(vacío=auto)', 'Ejemplo ticket — borrar fila',  'abierto',  'alta',      'Edwin Colmenares',  '2026-08-07'],
    ['(vacío=auto)', '',                              '',         '',          '',                  ''],
    ['(vacío=auto)', '',                              '',         '',          '',                  ''],
    ['(vacío=auto)', '',                              '',         '',          '',                  '']
  ]);
  ticketSheet['!cols'] = [{wch:14},{wch:44},{wch:14},{wch:12},{wch:22},{wch:15}];
  XLSX.utils.book_append_sheet(wb, ticketSheet, 'Tickets_Soporte_IT');

  // 6. Caidas_de_Red
  const netSheet = XLSX.utils.aoa_to_sheet([
    ['\uD83C\uDF10 SECCIÓN: Caidas_de_Red — Tipo: total / parcial / lenta. Estado: activa / resuelta'],
    ['ID',           'Evento',                         'Proveedor_ISP',   'Duracion', 'Fecha',      'Tipo',  'Estado'],
    ['(vacío=auto)', 'Ejemplo incidente — borrar fila', 'Inter / NetUno', '2h 30m',   '2026-08-07', 'total', 'resuelta'],
    ['(vacío=auto)', '',                               '',                '',          '',           '',      ''],
    ['(vacío=auto)', '',                               '',                '',          '',           '',      ''],
    ['(vacío=auto)', '',                               '',                '',          '',           '',      '']
  ]);
  netSheet['!cols'] = [{wch:14},{wch:40},{wch:18},{wch:12},{wch:12},{wch:10},{wch:12}];
  XLSX.utils.book_append_sheet(wb, netSheet, 'Caidas_de_Red');

  // 7. Configuracion_y_Perfil
  const configSheet = XLSX.utils.aoa_to_sheet([
    ['\u2699\uFE0F SECCIÓN: Configuracion_y_Perfil — Solo edita la fila 3 con tus datos reales'],
    ['Usuario',                        'Email',                               'Telefono',             'Ubicacion',                    'Tasa_BCV', 'Tasa_Binance', 'Tasa_Airtm'],
    ['Edwin José Colmenares Pacheco',  'edwinjosecolmenares28@hotmail.com',   '+58 (0414) 135-6815',  'Guatire, Miranda, Venezuela',  36.50,      38.20,          38.10]
  ]);
  configSheet['!cols'] = [{wch:32},{wch:40},{wch:22},{wch:32},{wch:10},{wch:14},{wch:12}];
  XLSX.utils.book_append_sheet(wb, configSheet, 'Configuracion_y_Perfil');

  XLSX.writeFile(wb, 'Plantilla_Importacion_EJCP_TaskMaster.xlsx');
  showToast('\uD83D\uDCCB \u00a1Plantilla descargada! Abre el archivo, rellena los datos desde la fila 3 y s\u00fAbela en "Importar".', 'success');
}

// ═══════════════════════════════════════════
//  VACIAR TODA LA BASE DE DATOS DEL SISTEMA
// ═══════════════════════════════════════════

function clearAllSystemData() {
  if (!confirm(
    '\u26A0\uFE0F ATENCI\u00d3N: Se eliminar\u00e1n permanentemente:\n\n' +
    '  \u2022 Todas las transacciones financieras\n' +
    '  \u2022 Todas las tareas y pendientes\n' +
    '  \u2022 Todos los tickets de soporte IT\n' +
    '  \u2022 Todas las ca\u00eddas de red\n' +
    '  \u2022 Todas las deudas y abonos\n' +
    '  \u2022 Configuraci\u00f3n de tasas y perfil\n\n' +
    'El portafolio profesional NO ser\u00e1 eliminado.\n\n' +
    '\u00bfDeseas continuar?'
  )) return;

  if (!confirm('\uD83D\uDD34 \u00daCIMA ADVERTENCIA \u2014 Esta acci\u00f3n NO se puede deshacer.\n\n\u00bfConfirmas vaciar todo el sistema?')) {
    showToast('\u274c Operaci\u00f3n cancelada. Ning\u00FAn dato fue eliminado.', 'info');
    return;
  }

  [
    'ejcp_economy', 'ejcp_tasks', 'ejcp_tickets', 'ejcp_network',
    'ejcp_debts', 'ejcp_activities',
    'ejcp_rate_bcv', 'ejcp_rate_eur', 'ejcp_rate_binance', 'ejcp_rate_airtm', 'ejcp_rate',
    'ejcp_tk_cnt', 'ejcp_net_cnt', 'taskmaster_profile'
  ].forEach(function(k) { localStorage.removeItem(k); });

  APP.tasks = []; APP.tickets = []; APP.network = [];
  APP.economy = []; APP.activities = []; APP.debts = [];
  APP.ticketCounter = 1; APP.networkCounter = 1;

  showToast('\uD83D\uDDD1\uFE0F Sistema vaciado correctamente. El portafolio profesional se mantuvo intacto.', 'success');
  setTimeout(function() { location.reload(); }, 1200);
}
