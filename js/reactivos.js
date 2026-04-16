import { getList, sendRequest } from './api.js';
import { toast, setButtonLoading, setCatalogImage, validateRequired, slugify } from './ui-kit.js';

// Element references
const backHomeReact = document.getElementById('backHomeReact');
const reacStep1 = document.getElementById('reacStep1');
const reacStep2 = document.getElementById('reacStep2');
const reacStep3 = document.getElementById('reacStep3');
const reacBusqueda = document.getElementById('reacBusqueda');
const reacList = document.getElementById('reacList');
const buscarReactivoBtn = document.getElementById('buscarReactivoBtn');
const reacNombreEl = document.getElementById('reacNombre');
const reacImgEl = document.getElementById('reacImg');
const reacAccionSel = document.getElementById('reacAccion');
const reacFormCommon = document.getElementById('reacFormCommon');
const reacFormSolicitud = document.getElementById('reacFormSolicitud');
const reacCantidad = document.getElementById('reacCantidad');
const reacUnidad = document.getElementById('reacUnidad');
const unidadOtroDiv = document.getElementById('unidadOtroDiv');
const reacUnidadOtro = document.getElementById('reacUnidadOtro');
const reacControlado = document.getElementById('reacControlado');
const reacFileDiv = document.getElementById('reacFileDiv');
const reacFile = document.getElementById('reacFile');
const reacLabDestino = document.getElementById('reacLabDestino');
const reacCancelStep2 = document.getElementById('reacCancelStep2');
const reacAddBtn = document.getElementById('reacAddBtn');
const reacFinalizarBtn = document.getElementById('reacFinalizarBtn');
const reacResumenDiv = document.getElementById('reacResumen');
const reacNombreUsuario = document.getElementById('reacNombreUsuario');
const reacCorreoUsuario = document.getElementById('reacCorreoUsuario');
const reacFecha = document.getElementById('reacFecha');
const reacTipoAct = document.getElementById('reacTipoAct');
const reacNombreAct = document.getElementById('reacNombreAct');
const reacBackToSearch = document.getElementById('reacBackToSearch');
const reacEnviarBtn = document.getElementById('reacEnviarBtn');

let reacCart = [];
let currentReactivo = null;
let fpFechaGeneral = null;

// Load reactivo list on load
window.addEventListener('load', async () => {
  try {
    const list = await getList('listReactivos');
    reacList.innerHTML = list.map(item => `<option value="${item}"></option>`).join('');
  } catch (err) {
    console.error('Error al cargar lista de reactivos:', err);
    reacList.innerHTML = '';
  }
  // Prefill user information from localStorage if available
  try {
    const storedNombre = localStorage.getItem('nombreUsuario');
    const storedCorreo = localStorage.getItem('correoUsuario');
    if (storedNombre) reacNombreUsuario.value = storedNombre;
    if (storedCorreo) reacCorreoUsuario.value = storedCorreo;
  } catch (e) {}
});

// Regresar a la página unificada de solicitudes
backHomeReact.addEventListener('click', () => {
  window.location.href = 'solicitudes.html';
});

// Search reactivo
buscarReactivoBtn.addEventListener('click', () => {
  const r = reacBusqueda.value.trim();
  if (!r) {
    toast('Por favor, ingrese o seleccione un reactivo.', { type: 'error' });
    return;
  }
  currentReactivo = r;
  showReactivoStep2(r);
});

function resetReactivoStep2() {
  // No reiniciar reacAccionSel aquí para mantener la selección actual
  reacFormCommon.classList.add('hidden');
  reacFormSolicitud.classList.add('hidden');
  reacCantidad.value = '';
  reacUnidad.value = '';
  unidadOtroDiv.classList.add('hidden');
  reacUnidadOtro.value = '';
  reacControlado.checked = false;
  reacFileDiv.classList.add('hidden');
  reacFile.value = '';
  reacLabDestino.value = '';
}

function showReactivoStep2(name) {
  reacStep1.classList.add('hidden');
  reacStep3.classList.add('hidden');
  reacStep2.classList.remove('hidden');
  reacNombreEl.textContent = name;
  const slug = slugify(name);
  setCatalogImage(reacImgEl, { basePath: 'imagenes/reactivos', slug });
  // Al seleccionar un nuevo reactivo, limpiar selección de acción y restablecer formularios
  reacAccionSel.value = '';
  resetReactivoStep2();
}

// When action selected
reacAccionSel.addEventListener('change', () => {
  resetReactivoStep2();
  const action = reacAccionSel.value;
  if (!action) return;
  reacFormCommon.classList.remove('hidden');
  // Show solicitud-specific field
  if (action === 'Solicitud') {
    reacFormSolicitud.classList.remove('hidden');
  }
});

// Unit change: show other input if 'otro'
reacUnidad.addEventListener('change', () => {
  if (reacUnidad.value === 'otro') {
    unidadOtroDiv.classList.remove('hidden');
  } else {
    unidadOtroDiv.classList.add('hidden');
    reacUnidadOtro.value = '';
  }
});

// Controlled checkbox: show file input
reacControlado.addEventListener('change', () => {
  if (reacControlado.checked) {
    reacFileDiv.classList.remove('hidden');
  } else {
    reacFileDiv.classList.add('hidden');
    reacFile.value = '';
  }
});

// Cancel step2
reacCancelStep2.addEventListener('click', () => {
  reacStep2.classList.add('hidden');
  reacStep1.classList.remove('hidden');
  reacBusqueda.value = '';
});

// Add reactivo item
reacAddBtn.addEventListener('click', () => {
  if (!processReactivo()) return;
  reacStep2.classList.add('hidden');
  reacStep1.classList.remove('hidden');
  reacBusqueda.value = '';
});

// Finalize reactivos
reacFinalizarBtn.addEventListener('click', () => {
  if (!processReactivo()) return;
  showReactivoStep3();
});

function processReactivo() {
  const action = reacAccionSel.value;
  if (!action) {
    toast('Seleccione el tipo de accion.', { type: 'error' });
    return false;
  }
  const cantidad = reacCantidad.value;
  let unidad = reacUnidad.value;
  const unidadOtro = reacUnidadOtro.value;
  if (!cantidad || !unidad || (unidad === 'otro' && !unidadOtro)) {
    toast('Ingrese la cantidad y la unidad.', { type: 'error' });
    return false;
  }
  if (unidad === 'otro') unidad = unidadOtro;
  const controlado = reacControlado.checked;
  const file = reacFile.files[0] || null;
  if (controlado && !file) {
    toast('Debe subir el archivo para reactivos controlados.', { type: 'error' });
    return false;
  }
  if (action === 'Solicitud') {
    const labDestino = reacLabDestino.value;
    if (!labDestino) {
      toast('Indique el laboratorio de destino.', { type: 'error' });
      return false;
    }
    reacCart.push({
      tipo: 'Solicitud de Reactivos',
      reactivo: currentReactivo,
      cantidad: `${cantidad} ${unidad}`,
      laboratorioDestino: labDestino,
      controlado: controlado,
      file: file
    });
  } else if (action === 'Registro') {
    reacCart.push({
      tipo: 'Uso de Reactivo',
      reactivo: currentReactivo,
      cantidad: `${cantidad} ${unidad}`,
      controlado: controlado,
      file: file
    });
  }
  return true;
}

function showReactivoStep3() {
  reacStep1.classList.add('hidden');
  reacStep2.classList.add('hidden');
  // Build summary
  renderSummary_();
  // Initialize date picker for fecha if not yet done
  if (!fpFechaGeneral) {
    fpFechaGeneral = flatpickr(reacFecha, { dateFormat: 'd/m/Y' });
    // Default to today
    const today = new Date();
    fpFechaGeneral.setDate(today, true);
  }
  reacStep3.classList.remove('hidden');
}

function renderSummary_() {
  let html = '<ul class="summary-list">';
  reacCart.forEach((item, idx) => {
    const title = escapeHtml_(item.reactivo || '');
    const controlled = item.controlado ? 'Controlado' : 'No controlado';
    let meta = '';
    if (item.tipo === 'Solicitud de Reactivos') {
      meta = `Solicitud - Cantidad: ${escapeHtml_(item.cantidad)} - ${escapeHtml_(controlled)} - Destino: ${escapeHtml_(item.laboratorioDestino || '')}`;
    } else {
      meta = `Registro - Cantidad: ${escapeHtml_(item.cantidad)} - ${escapeHtml_(controlled)}`;
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
  reacResumenDiv.innerHTML = html;
}

reacResumenDiv.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest ? e.target.closest('button[data-remove]') : null;
  if (!btn) return;
  const idx = Number(btn.dataset.remove);
  if (!Number.isFinite(idx)) return;
  reacCart.splice(idx, 1);
  if (reacCart.length === 0) {
    reacStep3.classList.add('hidden');
    reacStep1.classList.remove('hidden');
    toast('Carrito vacio. Agrega un reactivo para continuar.', { type: 'info' });
    return;
  }
  renderSummary_();
});

// Back to search from summary
reacBackToSearch.addEventListener('click', () => {
  reacStep3.classList.add('hidden');
  reacStep1.classList.remove('hidden');
});

// Send all reactivos
reacEnviarBtn.addEventListener('click', async () => {
  if (reacCart.length === 0) {
    toast('No hay reactivos para enviar.', { type: 'error' });
    return;
  }
  if (!validateRequired([reacNombreUsuario, reacCorreoUsuario, reacTipoAct, reacNombreAct])) {
    toast('Complete todos los campos obligatorios.', { type: 'error' });
    return;
  }
  const fechaIso = parseFechaReac(reacFecha.value);
  const payload = {
    nombre: reacNombreUsuario.value,
    correo: reacCorreoUsuario.value,
    fecha: fechaIso,
    tipoActividad: reacTipoAct.value,
    nombreActividad: reacNombreAct.value,
    tipo: 'Reactivos'
  };
  // Determine if there is any file
  let attachFile = null;
  for (const item of reacCart) {
    if (item.file) {
      attachFile = item.file;
      break;
    }
  }
  try {
    setButtonLoading(reacEnviarBtn, true);
    const msg = await sendRequest(payload, reacCart.map(item => {
      const obj = { tipo: item.tipo, reactivo: item.reactivo, cantidad: item.cantidad };
      if (item.tipo === 'Solicitud de Reactivos') {
        obj.laboratorioDestino = item.laboratorioDestino;
      }
      obj.controlado = item.controlado;
      return obj;
    }), attachFile);
    toast(msg || 'Solicitud enviada correctamente', { type: 'success' });
    // Limpiar carrito
    reacCart = [];
    // Reset summary form fields
    reacNombreUsuario.value = '';
    reacCorreoUsuario.value = '';
    reacTipoAct.value = '';
    reacNombreAct.value = '';
    // Después de enviar, redirigir a la página unificada de solicitudes
    window.location.href = 'solicitudes.html';
  } catch (err) {
    console.error(err);
    toast('Ocurrio un error al enviar la solicitud.', { type: 'error' });
  } finally {
    setButtonLoading(reacEnviarBtn, false);
  }
});

// Helpers
function escapeHtml_(s) {
  return String(s || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}
function parseFechaReac(fechaStr) {
  const parts = fechaStr.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return fechaStr;
}
