/************************************************************
 * appsScript.js — unica fuente de verdad para Google Apps Script
 * - Reservas de equipos con fecha + hora
 * - Creacion de eventos en Google Calendar
 * - Busy slots con horas para bloquear en frontend
 ************************************************************/

const ADMIN_EMAIL     = 'melani.ochoa@ikiam.edu.ec';
const DRIVE_FOLDER_ID = '1N5SA-KDhXeJXw4EYQiQ3mWhZL0RlKz8T';
const CALENDAR_ID     = 'c_3e66be30c74e5bec0b8b89bfd9bcce1bb7055482f9027d5b51d3a477f65fa6e3@group.calendar.google.com';

const SS_GENERAL_ID   = '1QqMr5qno1h4D8sxfosfAxv6db7B6D2v-1JdvtVvxqSY';
const SS_EQUIPOS_ID   = '1cY7sj5E8KyX7sBGCI7bHQmWL5J2QXu9vz5cBcLKJVNs';
const SS_REACTIVOS_ID = '1-X0XdIWNZ8k6vW7Z8FyvQmoCpzj0gaMPCD5u_P7-xDY';
const SS_INSUMOS_ID   = '1tEZY38GixIRIHW4xRm-bOJJYlosfSTSw28rLf0gK0GI';

function doPost(e) {
  Logger.log('PARAMS doPost: ' + JSON.stringify((e && e.parameter) || {}));
  const ss = SpreadsheetApp.openById(SS_GENERAL_ID);
  const params = (e && e.parameter) || {};

  if (params.action === 'dashboard') {
    const output = buildDashboardStub_();
    return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(ContentService.MimeType.JSON);
  }

  if (params.items) {
    return processMultiRequest_(ss, params);
  }
  return processSingleRequest_(ss, params);
}

function doGet(e) {
  const sheetEquiposData   = SpreadsheetApp.openById(SS_EQUIPOS_ID).getSheetByName('Equipos');
  const sheetReactivosData = SpreadsheetApp.openById(SS_REACTIVOS_ID).getSheetByName('Reactivos');
  const sheetInsumosData   = SpreadsheetApp.openById(SS_INSUMOS_ID).getSheetByName('Insumos');
  const ssGeneral          = SpreadsheetApp.openById(SS_GENERAL_ID);

  const action = (e.parameter && e.parameter.action) || '';
  const q      = ((e.parameter && e.parameter.q) || '').toString().toLowerCase();

  function filterList(list) {
    if (!q) return list;
    return list.filter(item => item.toString().toLowerCase().includes(q));
  }

  let output;
  switch (action) {
    case 'listReactivos':
      output = filterList(getColumnValues_(sheetReactivosData, 1));
      break;
    case 'listInsumos':
      output = filterList(getColumnValues_(sheetInsumosData, 1));
      break;
    case 'listEquipos':
      output = filterList(getColumnValues_(sheetEquiposData, 1));
      break;
    case 'availEquipos': {
      const start = e.parameter.start;
      const end   = e.parameter.end;
      output = filterList(getAvailableEquipos_(sheetEquiposData, ssGeneral, start, end));
      break;
    }
    case 'busyEquipos': {
      const equipo = e.parameter.equipo;
      output = getBusyEquipos_(ssGeneral, equipo);
      break;
    }
    case 'agenda': {
      const days = Math.max(1, Math.min(31, Number(e.parameter.days) || 14));
      output = getAgendaEquipos_(ssGeneral, days);
      break;
    }
    case 'dashboard': {
      output = buildDashboardStub_();
      break;
    }
    default:
      output = { error: 'Accion no reconocida' };
  }

  const cbRaw = (e.parameter && e.parameter.callback) ? String(e.parameter.callback) : '';
  const cb = (/^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/).test(cbRaw) ? cbRaw : '';
  const json = JSON.stringify(output);

  if (cb) {
    return ContentService.createTextOutput(`${cb}(${json});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function processMultiRequest_(ss, params) {
  const sheetResumen     = ss.getSheetByName('Resumen general');
  const sheetEquipos     = ss.getSheetByName('Solicitud de Equipos');
  const sheetUsoEquipo   = ss.getSheetByName('Uso de equipo');
  const sheetInsumos     = ss.getSheetByName('Solicitud de Insumos');
  const sheetUsoInsumos  = ss.getSheetByName('Uso de Insumos');
  const sheetReactivos   = ss.getSheetByName('Solicitud de Reactivos');
  const sheetUsoReactivo = ss.getSheetByName('Uso de Reactivo');

  let items = [];
  try {
    items = JSON.parse(params.items);
    if (!Array.isArray(items)) items = [];
  } catch (_) {
    items = [];
  }

  const nombre        = params.nombre || '';
  const correo        = params.correo || '';
  const tz            = Session.getScriptTimeZone();
  const fecha         = params.fecha || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const observaciones = params.observaciones || '';
  const tipoSolicitud = params.tipo || '';
  const file          = handleAttachment_(params);

  if (sheetResumen) {
    sheetResumen.appendRow([
      nombre,
      correo,
      fecha,
      tipoSolicitud || 'Multiple',
      observaciones,
      'Total items: ' + items.length
    ]);
  }

  items.forEach(it => {
    switch (it.tipo) {
      case 'Solicitud de Equipos': {
        let obsRow = observaciones || '';
        if (it.actividad) obsRow += (obsRow ? '; ' : '') + 'Actividad: ' + it.actividad;
        if (it.descripcion) obsRow += (obsRow ? '; ' : '') + it.descripcion;

        if (sheetEquipos) {
          sheetEquipos.appendRow([
            nombre,
            fecha,
            it.equipo || '',
            it.fechaInicial || '',
            it.fechaFinal || '',
            obsRow,
            correo,
            it.horaInicio || '',
            it.horaFin || ''
          ]);
        }

        createEquipmentCalendarEvent_({
          nombre: nombre,
          correo: correo,
          equipo: it.equipo || '',
          fechaInicial: it.fechaInicial || '',
          fechaFinal: it.fechaFinal || '',
          horaInicio: it.horaInicio || '',
          horaFin: it.horaFin || '',
          actividad: it.actividad || '',
          descripcion: it.descripcion || '',
          observaciones: observaciones || ''
        });
        break;
      }
      case 'Uso de equipo': {
        let obsRow = '';
        if (it.descripcion) obsRow += it.descripcion;
        if (observaciones) obsRow += (obsRow ? '; ' : '') + observaciones;
        if (sheetUsoEquipo) {
          sheetUsoEquipo.appendRow([
            nombre,
            it.fechaUsoEquipo || fecha,
            it.equipo || '',
            it.actividad || '',
            obsRow,
            correo
          ]);
        }
        createEquipmentCalendarEvent_({
          nombre: nombre,
          correo: correo,
          equipo: it.equipo || '',
          fechaInicial: it.fechaUsoEquipo || fecha,
          fechaFinal: it.fechaUsoEquipoFin || it.fechaUsoEquipo || fecha,
          horaInicio: it.horaInicio || '',
          horaFin: it.horaFin || '',
          actividad: it.actividad || 'Uso de equipo',
          descripcion: it.descripcion || '',
          observaciones: observaciones || ''
        });
        break;
      }
      case 'Solicitud de Insumos': {
        let obsRow = 'Cantidad: ' + (it.cantidad || '');
        if (it.actividad) obsRow += '; Actividad: ' + it.actividad;
        if (it.descripcion) obsRow += '; ' + it.descripcion;
        if (observaciones) obsRow += '; ' + observaciones;
        if (sheetInsumos) {
          sheetInsumos.appendRow([
            nombre,
            it.fechaSolicitudInsumos || fecha,
            '',
            it.insumo || '',
            it.fechaDevolucion || '',
            obsRow,
            correo
          ]);
        }
        break;
      }
      case 'Uso de Insumos': {
        let obsRow = 'Cantidad: ' + (it.cantidad || '');
        if (it.descripcion) obsRow += '; ' + it.descripcion;
        if (observaciones) obsRow += '; ' + observaciones;
        if (sheetUsoInsumos) {
          sheetUsoInsumos.appendRow([
            nombre,
            it.fechaUsoInsumos || fecha,
            '',
            it.insumo || '',
            it.actividad || '',
            obsRow,
            correo
          ]);
        }
        break;
      }
      case 'Solicitud de Reactivos':
        if (sheetReactivos) {
          sheetReactivos.appendRow([
            nombre,
            fecha,
            it.reactivo || '',
            it.cantidad || '',
            it.laboratorioDestino || '',
            params.tipoActividad || '',
            observaciones + (it.controlado ? '; Controlado' : ''),
            correo
          ]);
        }
        break;
      case 'Uso de Reactivo':
        if (sheetUsoReactivo) {
          sheetUsoReactivo.appendRow([
            nombre,
            fecha,
            it.reactivo || '',
            it.cantidad || '',
            params.tipoActividad || '',
            observaciones + (it.controlado ? '; Controlado' : ''),
            correo
          ]);
        }
        break;
    }
  });

  sendEmails_({ nombre, correo, tipo: tipoSolicitud, observaciones, fecha }, items, file);

  return ContentService.createTextOutput('Registro guardado').setMimeType(ContentService.MimeType.TEXT_PLAIN);
}

function processSingleRequest_(ss, params) {
  const tipo             = params.tipo || '';
  const sheetResumen     = ss.getSheetByName('Resumen general');
  const sheetReactivos   = ss.getSheetByName('Solicitud de Reactivos');
  const sheetInsumos     = ss.getSheetByName('Solicitud de Insumos');
  const sheetEquipos     = ss.getSheetByName('Solicitud de Equipos');
  const sheetUsoReactivo = ss.getSheetByName('Uso de Reactivo');
  const sheetUsoInsumos  = ss.getSheetByName('Uso de Insumos');
  const sheetUsoEquipo   = ss.getSheetByName('Uso de equipo');

  const tz = Session.getScriptTimeZone();
  const fechaEnvio = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const d = {
    nombre: params.nombre || '',
    correo: params.correo || '',
    fecha: params.fecha || fechaEnvio,
    fechaSolicitudReactivo: params.fechaSolicitudReactivo || '',
    reactivo: params.reactivo || '',
    cantidad: params.cantidad || '',
    unidad: params.unidad || '',
    laboratorioDestino: params.laboratorioDestino || '',
    tipoActividad: params.tipoActividad || '',
    fechaSolicitudInsumos: params.fechaSolicitudInsumos || '',
    estado: params.estado || '',
    insumo: params.insumo || '',
    fechaDevolucion: params.fechaDevolucion || '',
    equipo: params.equipo || '',
    fechaInicial: params.fechaInicial || '',
    fechaFinal: params.fechaFinal || '',
    horaInicio: params.horaInicio || '',
    horaFin: params.horaFin || '',
    descripcion: params.descripcion || '',
    fechaUsoReactivo: params.fechaUsoReactivo || '',
    fechaUsoInsumos: params.fechaUsoInsumos || '',
    nombreActividad: params.nombreActividad || '',
    fechaUsoEquipo: params.fechaUsoEquipo || '',
    fechaUsoEquipoFin: params.fechaUsoEquipoFin || '',
    observaciones: params.observaciones || ''
  };

  const cantidadCompleta = (d.cantidad && d.unidad) ? (d.cantidad + ' ' + d.unidad) : d.cantidad;
  const descGeneral = d.reactivo || d.insumo || d.equipo || d.descripcion || '';

  if (sheetResumen) {
    sheetResumen.appendRow([d.nombre, d.correo, d.fecha, tipo, d.observaciones, descGeneral]);
  }

  switch (tipo) {
    case 'Solicitud de Reactivos':
      if (sheetReactivos) {
        sheetReactivos.appendRow([d.nombre, d.fechaSolicitudReactivo, d.reactivo, cantidadCompleta, d.laboratorioDestino, d.tipoActividad, d.observaciones, d.correo]);
      }
      break;
    case 'Solicitud de Insumos':
      if (sheetInsumos) {
        sheetInsumos.appendRow([d.nombre, d.fechaSolicitudInsumos, d.estado, d.insumo, d.fechaDevolucion, d.observaciones, d.correo]);
      }
      break;
    case 'Solicitud de Equipos':
      if (sheetEquipos) {
        sheetEquipos.appendRow([d.nombre, d.fecha, d.equipo, d.fechaInicial, d.fechaFinal, d.observaciones, d.correo, d.horaInicio, d.horaFin]);
      }
      createEquipmentCalendarEvent_({
        nombre: d.nombre,
        correo: d.correo,
        equipo: d.equipo,
        fechaInicial: d.fechaInicial,
        fechaFinal: d.fechaFinal,
        horaInicio: d.horaInicio,
        horaFin: d.horaFin,
        actividad: d.nombreActividad || d.tipoActividad || '',
        descripcion: d.descripcion || '',
        observaciones: d.observaciones
      });
      break;
    case 'Uso de Reactivo':
      if (sheetUsoReactivo) {
        sheetUsoReactivo.appendRow([d.nombre, d.fechaUsoReactivo, d.reactivo, cantidadCompleta, d.tipoActividad, d.observaciones, d.correo]);
      }
      break;
    case 'Uso de Insumos':
      if (sheetUsoInsumos) {
        sheetUsoInsumos.appendRow([d.nombre, d.fechaUsoInsumos, d.estado, d.insumo, d.nombreActividad, d.observaciones, d.correo]);
      }
      break;
    case 'Uso de equipo':
      if (sheetUsoEquipo) {
        sheetUsoEquipo.appendRow([d.nombre, d.fechaUsoEquipo, d.equipo, d.nombreActividad, d.observaciones, d.correo]);
      }
      createEquipmentCalendarEvent_({
        nombre: d.nombre,
        correo: d.correo,
        equipo: d.equipo,
        fechaInicial: d.fechaUsoEquipo,
        fechaFinal: d.fechaUsoEquipoFin || d.fechaUsoEquipo,
        horaInicio: d.horaInicio,
        horaFin: d.horaFin,
        actividad: d.nombreActividad || 'Uso de equipo',
        descripcion: d.descripcion || '',
        observaciones: d.observaciones
      });
      break;
  }

  const file = handleAttachment_(params);
  sendEmails_({ nombre: d.nombre, correo: d.correo, tipo, observaciones: d.observaciones, fecha: d.fecha }, [params], file);

  return ContentService.createTextOutput('Registro guardado').setMimeType(ContentService.MimeType.TEXT_PLAIN);
}

function getBusyEquipos_(ssGeneral, equipo) {
  const tz = Session.getScriptTimeZone();
  const sh = ssGeneral.getSheetByName('Solicitud de Equipos');
  if (!sh || sh.getLastRow() < 2) return [];
  const range = sh.getDataRange();
  const data = range.getValues().slice(1);
  const display = range.getDisplayValues().slice(1);
  return data
    .map((r, idx) => ({ values: r, display: display[idx] || [] }))
    .filter(row => String(row.values[2] || '').trim() === String(equipo || '').trim())
    .map(buildEquipmentIntervalFromRow_)
    .map(intervalo => intervalo ? {
      from: Utilities.formatDate(intervalo.from, tz, 'yyyy-MM-dd'),
      to: Utilities.formatDate(intervalo.to, tz, 'yyyy-MM-dd'),
      horaInicio: intervalo.horaInicio,
      horaFin: intervalo.horaFin,
      startAt: Utilities.formatDate(intervalo.start, tz, "yyyy-MM-dd'T'HH:mm:ss"),
      endAt: Utilities.formatDate(intervalo.end, tz, "yyyy-MM-dd'T'HH:mm:ss")
    } : null)
    .filter(Boolean);
}

function getAgendaEquipos_(ssGeneral, days) {
  const tz = Session.getScriptTimeZone();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + Number(days || 14));
  end.setHours(23, 59, 59, 999);

  const sh = ssGeneral.getSheetByName('Solicitud de Equipos');
  if (!sh || sh.getLastRow() < 2) {
    return { range: { from: Utilities.formatDate(start, tz, 'yyyy-MM-dd'), to: Utilities.formatDate(end, tz, 'yyyy-MM-dd') }, upcoming: [] };
  }

  const range = sh.getDataRange();
  const values = range.getValues().slice(1);
  const display = range.getDisplayValues().slice(1);
  const out = [];
  values.forEach((r, idx) => {
    const intervalo = buildEquipmentIntervalFromRow_({ values: r, display: display[idx] || [] });
    if (!intervalo) return;
    if (intervalo.end < start || intervalo.start > end) return;
    out.push({
      from: Utilities.formatDate(intervalo.start, tz, 'yyyy-MM-dd'),
      to: Utilities.formatDate(intervalo.end, tz, 'yyyy-MM-dd'),
      horaInicio: intervalo.horaInicio,
      horaFin: intervalo.horaFin,
      startAt: Utilities.formatDate(intervalo.start, tz, "yyyy-MM-dd'T'HH:mm:ss"),
      endAt: Utilities.formatDate(intervalo.end, tz, "yyyy-MM-dd'T'HH:mm:ss"),
      equipo: String(r[2] || '').trim(),
      nombre: String(r[0] || '').trim(),
      correo: String(r[6] || '').trim()
    });
  });

  return {
    range: { from: Utilities.formatDate(start, tz, 'yyyy-MM-dd'), to: Utilities.formatDate(end, tz, 'yyyy-MM-dd') },
    upcoming: out.slice(0, 30)
  };
}

function getAvailableEquipos_(sheetEquiposData, ssGeneral, start, end) {
  const all = getColumnValues_(sheetEquiposData, 1);
  if (!start || !end) return all;

  const sh = ssGeneral.getSheetByName('Solicitud de Equipos');
  if (!sh || sh.getLastRow() < 2) return all;

  const startDate = parseCalendarDate_(start);
  const endDate = parseCalendarDate_(end);
  const range = sh.getDataRange();
  const rows = range.getValues().slice(1);
  const display = range.getDisplayValues().slice(1);

  const ocupados = rows
    .filter((r, idx) => {
      const intervalo = buildEquipmentIntervalFromRow_({ values: r, display: display[idx] || [] });
      if (!intervalo) return false;
      return !(intervalo.end < startDate || intervalo.start > endDate);
    })
    .map(r => String(r[2] || '').trim());

  return all.filter(e => ocupados.indexOf(e) === -1);
}

function buildEquipmentIntervalFromRow_(row) {
  const values = Array.isArray(row) ? row : (row && row.values) || [];
  const display = (row && row.display) || [];
  const startDate = parseCalendarDate_(values[3]);
  const endDate = parseCalendarDate_(values[4]) || startDate;
  if (!startDate || !endDate) return null;

  const horaInicio = normalizeSheetTime_(values[7], display[7]);
  const horaFin = normalizeSheetTime_(values[8], display[8]);
  const start = combineDateAndTime_(startDate, horaInicio || '00:00');
  const end = combineDateAndTime_(endDate, horaFin || '23:59');
  if (!start || !end) return null;

  return {
    start: start,
    end: end,
    from: startDate,
    to: endDate,
    horaInicio: horaInicio,
    horaFin: horaFin
  };
}

function normalizeSheetTime_(value, displayValue) {
  const display = String(displayValue || '').trim();
  const displayNorm = normalizeClockString_(display);
  if (displayNorm) return displayNorm;

  const raw = String(value || '').trim();
  const rawNorm = normalizeClockString_(raw);
  if (rawNorm) return rawNorm;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return ('0' + value.getHours()).slice(-2) + ':' + ('0' + value.getMinutes()).slice(-2);
  }
  return '';
}

function normalizeClockString_(value) {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return '';
  return ('0' + m[1]).slice(-2) + ':' + m[2];
}

function createEquipmentCalendarEvent_(data) {
  try {
    Logger.log('createEquipmentCalendarEvent_ data: ' + JSON.stringify(data));

    if (!CALENDAR_ID) {
      Logger.log('Sin CALENDAR_ID');
      return;
    }

    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) {
      Logger.log('No se encontro el calendario con ID: ' + CALENDAR_ID);
      return;
    }

    const equipo = String(data.equipo || '').trim();
    const nombre = String(data.nombre || '').trim();
    const correo = String(data.correo || '').trim();
    const actividad = String(data.actividad || '').trim();
    const descripcion = String(data.descripcion || '').trim();
    const observaciones = String(data.observaciones || '').trim();
    const horaInicio = String(data.horaInicio || '').trim();
    const horaFin = String(data.horaFin || '').trim();
    const startDate = parseCalendarDate_(data.fechaInicial);
    const endDate = parseCalendarDate_(data.fechaFinal) || startDate;

    Logger.log('equipo=' + equipo);
    Logger.log('fechaInicial raw=' + data.fechaInicial);
    Logger.log('fechaFinal raw=' + data.fechaFinal);
    Logger.log('horaInicio=' + horaInicio);
    Logger.log('horaFin=' + horaFin);
    Logger.log('startDate=' + startDate);
    Logger.log('endDate=' + endDate);

    if (!equipo || !startDate || !endDate) {
      Logger.log('Abortado: faltan datos obligatorios');
      return;
    }

    const title = 'Reserva equipo: ' + equipo;
    const details = [
      nombre ? 'Usuario: ' + nombre : '',
      correo ? 'Correo: ' + correo : '',
      actividad ? 'Actividad: ' + actividad : '',
      descripcion ? 'Descripcion: ' + descripcion : '',
      horaInicio ? 'Hora inicio: ' + horaInicio : '',
      horaFin ? 'Hora fin: ' + horaFin : '',
      observaciones ? 'Observaciones: ' + observaciones : ''
    ].filter(Boolean).join('\n');

    if (horaInicio && horaFin && sameDay_(startDate, endDate)) {
      const start = combineDateAndTime_(startDate, horaInicio);
      const end = combineDateAndTime_(endDate, horaFin);
      Logger.log('Evento mismo dia start=' + start + ' end=' + end);
      if (start && end && end > start) {
        const event = calendar.createEvent(title, start, end, {
          description: details,
          guests: correo || undefined,
          sendInvites: false
        });
        try { event.setColor(CalendarApp.EventColor.RED); } catch (_) {}
        Logger.log('Evento creado OK: ' + event.getId());
        return;
      }
    }

    const start = combineDateAndTime_(startDate, horaInicio || '07:00') || startDate;
    const endBase = sameDay_(startDate, endDate) ? startDate : endDate;
    const end = combineDateAndTime_(endBase, horaFin || '20:00') || new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 20, 0, 0, 0);
    Logger.log('Evento fallback start=' + start + ' end=' + end);

    const event = calendar.createEvent(title, start, end, {
      description: details,
      guests: correo || undefined,
      sendInvites: false
    });
    try { event.setColor(CalendarApp.EventColor.RED); } catch (_) {}
    Logger.log('Evento fallback creado OK: ' + event.getId());
  } catch (err) {
    Logger.log('ERROR createEquipmentCalendarEvent_: ' + err);
    Logger.log('STACK: ' + (err && err.stack ? err.stack : 'sin stack'));
  }
}

function parseCalendarDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const s = String(value).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function combineDateAndTime_(date, hhmm) {
  if (!date || isNaN(date.getTime())) return null;
  const m = String(hhmm || '').trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(m[1]), Number(m[2]), 0, 0);
}

function sameDay_(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getColumnValues_(sheet, col) {
  if (!sheet) return [];
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, col, last - 1).getValues().flat().filter(String);
}

function handleAttachment_(params) {
  if (!params.fileBase64) return null;
  const mime = params.fileMimeType || MimeType.PDF;
  const blob = Utilities.newBlob(Utilities.base64Decode(params.fileBase64), mime, params.fileName || 'adjunto');
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    return folder.createFile(blob);
  } catch (_) {
    return null;
  }
}

function sendEmails_(payload, items, file) {
  const asunto = '[LPN] ' + (payload.tipo || 'Registro') + ' - ' + (payload.nombre || '');
  const html = renderEmailHtml_(payload, items);
  if (payload.correo) {
    MailApp.sendEmail({ to: payload.correo, subject: asunto, htmlBody: html });
  }
  const opts = { to: ADMIN_EMAIL, subject: asunto, htmlBody: html };
  if (file) opts.attachments = [file.getAs(file.getMimeType())];
  MailApp.sendEmail(opts);
}

function renderEmailHtml_(payload, items) {
  let html = '<p>Hola ' + sanitize_(payload.nombre || '') + ',</p>';
  html += '<p>Se registro la siguiente informacion:</p><ul>';
  (items || []).forEach(it => {
    const kv = Object.entries(it)
      .map(([k, v]) => '<strong>' + sanitize_(k) + ':</strong> ' + sanitize_(v))
      .join('<br>');
    html += '<li>' + kv + '</li><br>';
  });
  if (payload.observaciones) html += '<p><strong>Observaciones:</strong> ' + sanitize_(payload.observaciones) + '</p>';
  if (payload.fecha) html += '<p><strong>Fecha:</strong> ' + sanitize_(payload.fecha) + '</p>';
  html += '<p>Saludos,<br>LPN - Laboratorio de Productos Naturales</p>';
  return html;
}

function sanitize_(s) {
  return String(s || '').replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c]));
}

function buildDashboardStub_() {
  return { ok: true, message: 'dashboard disponible' };
}
