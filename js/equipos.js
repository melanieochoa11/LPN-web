import { getList, getBusyEquipos, sendRequest } from './api.js';
import { toast, setButtonLoading, setCatalogImage, validateRequired, slugify } from './ui-kit.js';

// Elements
const backHomeBtn = document.getElementById('backHome');
const step1      = document.getElementById('step1');
const step2      = document.getElementById('step2');
const step3      = document.getElementById('step3');
const equipoBusqueda = document.getElementById('equipoBusqueda');
const equiposList    = document.getElementById('equiposList');
const buscarEquipoBtn = document.getElementById('buscarEquipoBtn');
const equipoNombreEl  = document.getElementById('equipoNombre');
const equipoImgEl     = document.getElementById('equipoImg');
const equipoAccionSel = document.getElementById('equipoAccion');
const formSolicitudDiv= document.getElementById('formSolicitud');
const formRegistroDiv = document.getElementById('formRegistro');
const solicitudRango  = document.getElementById('solicitudRango');
const solicitudHoraInicio = document.getElementById('solicitudHoraInicio');
const solicitudHoraFin = document.getElementById('solicitudHoraFin');
const ocupacionInfo   = document.getElementById('ocupacionInfo');
const ocupacionDetalle = document.getElementById('ocupacionDetalle');
const registroRango   = document.getElementById('registroRango');
const registroHoraInicio = document.getElementById('registroHoraInicio');
const registroHoraFin = document.getElementById('registroHoraFin');
const registroTipo = document.getElementById('registroTipo');
const registroTipoDetalle = document.getElementById('registroTipoDetalle');
// Nuevo grupo de actividad que se muestra para Solicitud
const equipoActividadGroup = document.getElementById('equipoActividadGroup');
const equipoActividad = document.getElementById('equipoActividad');
const equipoDescripcion = document.getElementById('equipoDescripcion');
const cancelStep2Btn  = document.getElementById('cancelStep2');
const addEquipoBtn    = document.getElementById('addEquipoBtn');
const finalizarEquipoBtn = document.getElementById('finalizarEquipoBtn');
const summaryDiv      = document.getElementById('listaEquiposResumen');
const backToSearchBtn = document.getElementById('backToSearch');
const enviarEquiposBtn= document.getElementById('enviarEquipos');
const nombreUsuario   = document.getElementById('equipoNombreUsuario');
const correoUsuario   = document.getElementById('equipoCorreoUsuario');
const observaciones   = document.getElementById('equipoObservaciones');

// Cart to hold multiple equipment requests
let cart = [];

// Busy intervals and conflict flag
// "currentBusyIntervals" almacenará los rangos de ocupación del equipo seleccionado
// recuperados desde el backend. "solicitudConflicto" se actualizará a true si
// el usuario elige un rango de fechas que se superpone con alguno de estos
// intervalos.  Se comprueba tanto en el selector de fechas como al
// procesar la solicitud, de modo que el usuario no pueda enviar una
// reserva en fechas ya ocupadas.
let currentBusyIntervals = [];
let solicitudConflicto = false;
let currentEquipo = null;
let fpSolicitud  = null;
let fpRegistro   = null;

// Load list of equipos on load
window.addEventListener('load', async () => {
  try {
    const list = await getList('listEquipos');
    equiposList.innerHTML = list.map(item => `<option value="${item}"></option>`).join('');
  } catch (err) {
    console.error('Error al cargar lista de equipos:', err);
    equiposList.innerHTML = '';
  }
  // Prefill user information from localStorage if available
  try {
    const storedNombre = localStorage.getItem('nombreUsuario');
    const storedCorreo = localStorage.getItem('correoUsuario');
    if (storedNombre) nombreUsuario.value = storedNombre;
    if (storedCorreo) correoUsuario.value = storedCorreo;
  } catch (e) {
    // No localStorage available
  }
});

// Navigation back to home
backHomeBtn.addEventListener('click', () => {
  // Regresar a la página unificada de solicitudes en lugar de al inicio
  window.location.href = 'solicitudes.html';
});

// Buscar equipo
buscarEquipoBtn.addEventListener('click', () => {
  const eq = equipoBusqueda.value.trim();
  if (!eq) {
    toast('Por favor, ingrese o seleccione un equipo.', { type: 'error' });
    return;
  }
  currentEquipo = eq;
  showStep2(eq);
});

// Reset step2 fields
/**
 * Restaura los campos del paso 2 sin borrar la selección de acción.
 * Esto permite que al seleccionar "Solicitud" o "Registro" se mantenga
 * el valor en el selector mientras se ocultan/limpian los formularios.
 */
function resetStep2() {
  // No limpiar equipoAccionSel.value aquí; se limpia solo al cargar un nuevo equipo
  formSolicitudDiv.classList.add('hidden');
  formRegistroDiv.classList.add('hidden');
  ocupacionInfo.textContent = '';
  ocupacionDetalle.innerHTML = '';
  ocupacionDetalle.classList.add('hidden');
  solicitudHoraInicio.value = '';
  solicitudHoraFin.value = '';
  registroHoraInicio.value = '';
  registroHoraFin.value = '';
  if (fpSolicitud) { fpSolicitud.destroy(); fpSolicitud = null; }
  if (fpRegistro) { fpRegistro.destroy(); fpRegistro = null; }
  if (registroTipo) registroTipo.value = '';
  if (registroTipoDetalle) {
    registroTipoDetalle.innerHTML = '';
    registroTipoDetalle.classList.add('hidden');
  }
  // Limpiar campos de actividad de solicitud
  equipoActividad.value = '';
  equipoDescripcion.value = '';
  equipoActividadGroup.classList.add('hidden');
}

// Show step 2 for selected equipment
function showStep2(equipoName) {
  // Hide step1 and step3
  step1.classList.add('hidden');
  step3.classList.add('hidden');
  step2.classList.remove('hidden');
  // Set equipment name
  equipoNombreEl.textContent = equipoName;
  // Set image path using slug
  const slug = slugify(equipoName);
  setCatalogImage(equipoImgEl, { basePath: 'imagenes/equipos', slug });
  // Al abrir un nuevo equipo, limpiar la selección y restablecer formularios
  equipoAccionSel.value = '';
  resetStep2();
}

// Action selection
equipoAccionSel.addEventListener('change', async () => {
  const action = equipoAccionSel.value;
  // Siempre reiniciamos el paso 2 antes de mostrar el formulario correspondiente
  resetStep2();
  if (!action) return;
  if (action === 'Solicitud') {
    equipoActividadGroup.classList.remove('hidden');
    formSolicitudDiv.classList.remove('hidden');
    // Restablecer banderas y rangos ocupados
    solicitudConflicto = false;
    currentBusyIntervals = [];
    // Consultar las ocupaciones existentes del equipo y actualizar mensaje
    try {
      const busy = await getBusyEquipos(currentEquipo);
      currentBusyIntervals = Array.isArray(busy) ? busy : [];
      if (currentBusyIntervals.length > 0) {
        ocupacionInfo.innerHTML = '<strong>Fechas ocupadas:</strong> ' + currentBusyIntervals.map(formatBusyIntervalLabel).join(', ');
      } else {
        ocupacionInfo.textContent = 'No hay reservas registradas para este equipo.';
      }
      renderOcupacionDetalle();
    } catch (err) {
      console.error('Error al consultar ocupaciones:', err);
      ocupacionInfo.textContent = '';
      ocupacionDetalle.innerHTML = '';
      ocupacionDetalle.classList.add('hidden');
    }
    // Inicializar flatpickr marcando días ocupados en rojo
    fpSolicitud = flatpickr(solicitudRango, {
      mode: 'range',
      dateFormat: 'd/m/Y',
      onDayCreate: (_, __, ___, dayElem) => {
        const iso = toIsoDateLocal(dayElem.dateObj);
        if (currentBusyIntervals.some(intervalo => iso >= intervalo.from && iso <= intervalo.to)) {
          dayElem.classList.add('ocupado');
          dayElem.title = 'Hay horas ocupadas en esta fecha';
        }
      },
      onChange: () => {
        validateSolicitudConflict();
        renderOcupacionDetalle();
      },
      onClose: () => {
        validateSolicitudConflict(true);
      }
    });
  } else if (action === 'Registro') {
    formRegistroDiv.classList.remove('hidden');
    fpRegistro = flatpickr(registroRango, {
      mode: 'range',
      dateFormat: 'd/m/Y'
    });
  }
});

registroTipo.addEventListener('change', () => {
  buildRegistroDetalle_(registroTipo.value);
});

// Cancel button in step2
cancelStep2Btn.addEventListener('click', () => {
  step2.classList.add('hidden');
  step1.classList.remove('hidden');
  equipoBusqueda.value = '';
});

// Add another equipo
addEquipoBtn.addEventListener('click', () => {
  if (!processCurrentEquipo()) return;
  // Clear fields and return to search
  resetStep2();
  step2.classList.add('hidden');
  step1.classList.remove('hidden');
  equipoBusqueda.value = '';
});

solicitudHoraInicio.addEventListener('change', () => validateSolicitudConflict());
solicitudHoraFin.addEventListener('change', () => validateSolicitudConflict());

// Finalize
finalizarEquipoBtn.addEventListener('click', () => {
  if (!processCurrentEquipo()) return;
  showStep3();
});

// Process current equipo into cart. Returns false if validation fails.
function processCurrentEquipo() {
  const action = equipoAccionSel.value;
  if (!action) {
    toast('Seleccione el tipo de accion para el equipo.', { type: 'error' });
    return false;
  }
  if (action === 'Solicitud') {
    const rango = solicitudRango.value;
    if (!rango) {
      toast('Seleccione el rango de uso.', { type: 'error' });
      return false;
    }
    let fechas = rango.split(/\s*(?:to|a)\s*/);
    if (fechas.length < 2) {
      fechas = rango.split(' ');
    }
    const inicio = parseFechaEquipo(fechas[0]);
    const fin    = parseFechaEquipo(fechas[1] || fechas[0]);
    const horaInicio = solicitudHoraInicio.value;
    const horaFin = solicitudHoraFin.value;
    const act = equipoActividad.value;
    const desc = equipoDescripcion.value;
    if (!horaInicio || !horaFin) {
      toast('Seleccione la hora de inicio y fin.', { type: 'error' });
      return false;
    }
    if (horaFin <= horaInicio && inicio === fin) {
      toast('La hora de fin debe ser posterior a la hora de inicio.', { type: 'error' });
      return false;
    }
    if (!act || !desc) {
      toast('Seleccione la actividad y describa lo que se realizara.', { type: 'error' });
      return false;
    }
    validateSolicitudConflict();
    if (solicitudConflicto) {
      toast('El equipo esta ocupado en la fecha u hora seleccionada.', { type: 'error' });
      return false;
    }
    cart.push({
      tipo: 'Solicitud de Equipos',
      equipo: currentEquipo,
      fechaInicial: inicio,
      fechaFinal: fin,
      horaInicio: horaInicio,
      horaFin: horaFin,
      actividad: act,
      descripcion: desc
    });
  } else if (action === 'Registro') {
    const rango = registroRango.value;
    const detalle = collectRegistroDetalle_();
    const horaInicio = registroHoraInicio.value;
    const horaFin = registroHoraFin.value;
    if (!rango || !horaInicio || !horaFin || !detalle) {
      toast('Complete el rango, las horas y los datos del registro.', { type: 'error' });
      return false;
    }
    let fechas = rango.split(/\s*(?:to|a)\s*/);
    if (fechas.length < 2) fechas = rango.split(' ');
    const inicio = parseFechaEquipo(fechas[0]);
    const fin = parseFechaEquipo(fechas[1] || fechas[0]);
    if (horaFin <= horaInicio && inicio === fin) {
      toast('La hora de fin debe ser posterior a la hora de inicio.', { type: 'error' });
      return false;
    }
    cart.push({
      tipo: 'Uso de equipo',
      equipo: currentEquipo,
      fechaUsoEquipo: inicio,
      fechaUsoEquipoFin: fin,
      horaInicio: horaInicio,
      horaFin: horaFin,
      actividad: detalle.actividad,
      descripcion: [
        `Rango de uso: ${formatDate(inicio)} a ${formatDate(fin)}`,
        `Horario: ${horaInicio} - ${horaFin}`,
        detalle.descripcion
      ].filter(Boolean).join('; ')
    });
  }
  return true;
}

// Show summary step
function showStep3() {
  step1.classList.add('hidden');
  step2.classList.add('hidden');
  // Build summary list
  renderSummary_();
  step3.classList.remove('hidden');
}

function renderSummary_() {
  let html = '<ul class="summary-list">';
  cart.forEach((item, idx) => {
    const title = escapeHtml_(item.equipo || '');
    let meta = '';
    if (item.tipo === 'Solicitud de Equipos') {
      meta = `Solicitud (${formatDate(item.fechaInicial)} a ${formatDate(item.fechaFinal)}, ${item.horaInicio || '--:--'}-${item.horaFin || '--:--'}) - ${escapeHtml_(item.actividad || '')}`;
    } else {
      meta = `Registro (${formatDate(item.fechaUsoEquipo)} a ${formatDate(item.fechaUsoEquipoFin || item.fechaUsoEquipo)}, ${item.horaInicio || '--:--'}-${item.horaFin || '--:--'}) - ${escapeHtml_(item.actividad || '')} - ${escapeHtml_(item.descripcion || '')}`;
    }
    html += `
      <li>
        <div>
          <div><strong>${idx + 1}. ${title}</strong></div>
          <div class="meta">${meta}</div>
        </div>
        <button type="button" class="icon-btn danger" data-remove="${idx}">Quitar</button>
      </li>
    `;
  });
  html += '</ul>';
  summaryDiv.innerHTML = html;
}

summaryDiv.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest ? e.target.closest('button[data-remove]') : null;
  if (!btn) return;
  const idx = Number(btn.dataset.remove);
  if (!Number.isFinite(idx)) return;
  cart.splice(idx, 1);
  if (cart.length === 0) {
    step3.classList.add('hidden');
    step1.classList.remove('hidden');
    toast('Carrito vacio. Agrega un equipo para continuar.', { type: 'info' });
    return;
  }
  renderSummary_();
});

// Back to search from summary
backToSearchBtn.addEventListener('click', () => {
  step3.classList.add('hidden');
  step1.classList.remove('hidden');
});

// Send all equipos
enviarEquiposBtn.addEventListener('click', async () => {
  if (cart.length === 0) {
    toast('No hay equipos para enviar.', { type: 'error' });
    return;
  }
  if (!validateRequired([nombreUsuario, correoUsuario])) {
    toast('Revisa los campos obligatorios.', { type: 'error' });
    return;
  }
  const payload = {
    nombre: nombreUsuario.value,
    correo: correoUsuario.value,
    observaciones: observaciones.value || '',
    tipo: 'Equipos'
  };
  try {
    setButtonLoading(enviarEquiposBtn, true);
    const msg = await sendRequest(payload, cart);
    toast(msg || 'Solicitud enviada correctamente', { type: 'success' });
    // Reset everything
    cart = [];
    nombreUsuario.value = '';
    correoUsuario.value = '';
    observaciones.value = '';
    // Después de enviar, regresar a la página unificada de solicitudes para evitar bucles
    window.location.href = 'solicitudes.html';
  } catch (err) {
    console.error(err);
    toast('Ocurrio un error al enviar la solicitud.', { type: 'error' });
  } finally {
    setButtonLoading(enviarEquiposBtn, false);
  }
});

// Helpers
function escapeHtml_(s) {
  return String(s || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

function parseFechaEquipo(fechaStr) {
  // fechaStr en d/m/Y
  const parts = fechaStr.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return fechaStr;
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
}

function toIsoDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderOcupacionDetalle() {
  if (!currentBusyIntervals.length) {
    ocupacionDetalle.innerHTML = '';
    ocupacionDetalle.classList.add('hidden');
    return;
  }
  const selected = getSelectedRange();
  const relevant = selected
    ? currentBusyIntervals.filter(intervalo => selected.end >= intervalo.from && selected.start <= intervalo.to)
    : currentBusyIntervals;
  if (!relevant.length) {
    ocupacionDetalle.innerHTML = '';
    ocupacionDetalle.classList.add('hidden');
    return;
  }
  ocupacionDetalle.innerHTML = `
    <h4>Horarios ocupados</h4>
    <ul>${relevant.map(intervalo => `<li>${formatBusyIntervalLabel(intervalo)}</li>`).join('')}</ul>
  `;
  ocupacionDetalle.classList.remove('hidden');
}

function formatBusyIntervalLabel(intervalo) {
  const base = `${formatDate(intervalo.from)} - ${formatDate(intervalo.to)}`;
  if (intervalo.horaInicio || intervalo.horaFin) {
    return `${base} (${intervalo.horaInicio || '--:--'} - ${intervalo.horaFin || '--:--'})`;
  }
  return `${base} (todo el dia)`;
}

function getSelectedRange() {
  const rango = String(solicitudRango.value || '').trim();
  if (!rango) return null;
  let fechas = rango.split(/\s*(?:to|a)\s*/);
  if (fechas.length < 2) fechas = rango.split(' ');
  const start = parseFechaEquipo(fechas[0]);
  const end = parseFechaEquipo(fechas[1] || fechas[0]);
  if (!start || !end) return null;
  return { start, end };
}

function validateSolicitudConflict(showToast = false) {
  solicitudConflicto = false;
  const selected = getSelectedRange();
  const horaInicio = solicitudHoraInicio.value;
  const horaFin = solicitudHoraFin.value;
  if (!selected) return false;

   if (!horaInicio || !horaFin) {
    solicitudConflicto = currentBusyIntervals.some(intervalo => selected.end >= intervalo.from && selected.start <= intervalo.to);
    if (showToast && solicitudConflicto) {
      toast('El equipo ya tiene una reserva en la fecha u hora seleccionada.', { type: 'error' });
    }
    return solicitudConflicto;
  }

  const requestedStart = intervalStartMs_({ from: selected.start, horaInicio, to: selected.end, horaFin });
  const requestedEnd = intervalEndMs_({ from: selected.start, horaInicio, to: selected.end, horaFin });
  if (requestedStart === null || requestedEnd === null || requestedEnd <= requestedStart) {
    return false;
  }

  for (const intervalo of currentBusyIntervals) {
    const busyStart = intervalStartMs_(intervalo);
    const busyEnd = intervalEndMs_(intervalo);
    if (busyStart === null || busyEnd === null) continue;
    if (requestedStart < busyEnd && requestedEnd > busyStart) {
      solicitudConflicto = true;
      break;
    }
  }

  if (showToast && solicitudConflicto) {
    toast('El equipo ya tiene una reserva en la fecha u hora seleccionada.', { type: 'error' });
  }
  return solicitudConflicto;
}

function intervalStartMs_(intervalo) {
  const explicit = parseDateTimeMs_(intervalo && intervalo.startAt);
  if (explicit !== null) return explicit;
  const from = parseIsoDate_(intervalo && intervalo.from);
  if (!from) return null;
  const time = normalizeTime_(intervalo && intervalo.horaInicio, '00:00');
  return combineDateTimeLocal_(from, time).getTime();
}

function intervalEndMs_(intervalo) {
  const explicit = parseDateTimeMs_(intervalo && intervalo.endAt);
  if (explicit !== null) return explicit;
  const to = parseIsoDate_(intervalo && (intervalo.to || intervalo.from));
  if (!to) return null;
  const hasExplicitEndTime = Boolean(normalizeTime_(intervalo && intervalo.horaFin, ''));
  const time = normalizeTime_(intervalo && intervalo.horaFin, '23:59');
  const dt = combineDateTimeLocal_(to, time);
  if (!hasExplicitEndTime) {
    dt.setMinutes(dt.getMinutes() + 1);
  }
  return dt.getTime();
}

function parseIsoDate_(value) {
  const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function parseDateTimeMs_(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

function normalizeTime_(value, fallback) {
  const s = String(value || '').trim();
  return /^\d{2}:\d{2}$/.test(s) ? s : fallback;
}

function combineDateTimeLocal_(date, hhmm) {
  const [hours, minutes] = String(hhmm || '00:00').split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0, 0, 0);
}

function buildRegistroDetalle_(tipo) {
  registroTipoDetalle.innerHTML = '';
  registroTipoDetalle.classList.add('hidden');
  if (!tipo) return;

  let html = '';
  if (tipo === 'Practica') {
    html = `
      <div class="field">
        <label for="registroAsignatura">Asignatura</label>
        <input type="text" id="registroAsignatura" required aria-required="true" placeholder="Asignatura">
      </div>
      <div class="time-grid">
        <div class="field">
          <label for="registroHoraInicial">Hora inicial</label>
          <input type="time" id="registroHoraInicial" required aria-required="true">
        </div>
        <div class="field">
          <label for="registroHoraFinal">Hora final</label>
          <input type="time" id="registroHoraFinal" required aria-required="true">
        </div>
      </div>
      <div class="field">
        <label for="registroCedula">Cédula</label>
        <input type="text" id="registroCedula" required aria-required="true" placeholder="Cédula">
      </div>
    `;
  } else if (tipo === 'Pasantia') {
    html = `
      <div class="field">
        <label for="registroHoras">Horas</label>
        <input type="number" id="registroHoras" required aria-required="true" min="0" placeholder="Número de horas">
      </div>
      <div class="field">
        <label for="registroActividadRealizada">Actividad realizada</label>
        <input type="text" id="registroActividadRealizada" required aria-required="true" placeholder="Actividad realizada">
      </div>
    `;
  } else if (tipo === 'Tesis') {
    html = `
      <div class="field">
        <label for="registroActividadSelect">Actividad</label>
        <select id="registroActividadSelect" required aria-required="true">
          <option value="">– selecciona –</option>
          <option value="Proyecto">Proyecto</option>
          <option value="Tesis">Tesis</option>
        </select>
      </div>
      <div class="field">
        <label for="registroActividadRealizadaTesis">Actividad realizada</label>
        <input type="text" id="registroActividadRealizadaTesis" required aria-required="true" placeholder="Actividad realizada">
      </div>
      <div class="field">
        <label for="registroTipoPersona">Tipo de persona</label>
        <select id="registroTipoPersona" required aria-required="true">
          <option value="">– selecciona –</option>
          <option value="Estudiante">Estudiante</option>
          <option value="Investigador">Investigador</option>
        </select>
      </div>
      <div class="field">
        <label for="registroNombreTesis">Nombre de tesis</label>
        <input type="text" id="registroNombreTesis" required aria-required="true" placeholder="Nombre de tesis">
      </div>
    `;
  }

  registroTipoDetalle.innerHTML = html;
  registroTipoDetalle.classList.remove('hidden');
}

function collectRegistroDetalle_() {
  const tipo = registroTipo.value;
  if (!tipo) return null;

  const inputs = Array.from(registroTipoDetalle.querySelectorAll('input, select'));
  if (!validateRequired(inputs)) return null;

  if (tipo === 'Practica') {
    return {
      actividad: 'Práctica de lab o Cátedra',
      descripcion: [
        `Asignatura: ${document.getElementById('registroAsignatura').value}`,
        `Hora inicial: ${document.getElementById('registroHoraInicial').value}`,
        `Hora final: ${document.getElementById('registroHoraFinal').value}`,
        `Cédula: ${document.getElementById('registroCedula').value}`
      ].join('; ')
    };
  }

  if (tipo === 'Pasantia') {
    return {
      actividad: 'Pasantías',
      descripcion: [
        `Horas: ${document.getElementById('registroHoras').value}`,
        `Actividad realizada: ${document.getElementById('registroActividadRealizada').value}`
      ].join('; ')
    };
  }

  if (tipo === 'Tesis') {
    return {
      actividad: document.getElementById('registroActividadSelect').value,
      descripcion: [
        `Actividad realizada: ${document.getElementById('registroActividadRealizadaTesis').value}`,
        `Tipo de persona: ${document.getElementById('registroTipoPersona').value}`,
        `Nombre de tesis: ${document.getElementById('registroNombreTesis').value}`
      ].join('; ')
    };
  }

  return null;
}
