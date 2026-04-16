import { getList, sendRequest } from './api.js';
import { toast, setButtonLoading, setCatalogImage, validateRequired, slugify } from './ui-kit.js';

// Elements
const backHomeMatBtn = document.getElementById('backHomeMat');
const matStep1 = document.getElementById('matStep1');
const matStep2 = document.getElementById('matStep2');
const matStep3 = document.getElementById('matStep3');
const matBusqueda = document.getElementById('matBusqueda');
const materialList = document.getElementById('materialList');
const buscarMaterialBtn = document.getElementById('buscarMaterialBtn');
const matNombreEl = document.getElementById('matNombre');
const matImgEl = document.getElementById('matImg');
const matAccionSel = document.getElementById('matAccion');
const matFormSolicitud = document.getElementById('matFormSolicitud');
const matFormRegistro  = document.getElementById('matFormRegistro');
const matRango    = document.getElementById('matRango');
const matCantidadSol = document.getElementById('matCantidadSol');
const matFechaUso = document.getElementById('matFechaUso');
const matCantidadReg = document.getElementById('matCantidadReg');
// Grupo de actividad para ambas acciones
const matActividadGroup = document.getElementById('matActividadGroup');
const matActividad  = document.getElementById('matActividad');
const matDescripcion= document.getElementById('matDescripcion');
const matCancelStep2 = document.getElementById('matCancelStep2');
const matAddBtn   = document.getElementById('matAddBtn');
const matFinalizarBtn = document.getElementById('matFinalizarBtn');
const matResumenDiv = document.getElementById('matResumen');
const matBackToSearch = document.getElementById('matBackToSearch');
const matEnviarBtn = document.getElementById('matEnviar');
const matNombreUsuario = document.getElementById('matNombreUsuario');
const matCorreoUsuario = document.getElementById('matCorreoUsuario');
const matObsUsuario    = document.getElementById('matObsUsuario');

let matCart = [];
let currentMaterial = null;
let fpMatSolicitud = null;
let fpMatRegistro  = null;

// Load material list on load
window.addEventListener('load', async () => {
  try {
    const list = await getList('listInsumos');
    materialList.innerHTML = list.map(item => `<option value="${item}"></option>`).join('');
  } catch (err) {
    console.error('Error al cargar lista de materiales:', err);
    materialList.innerHTML = '';
  }
  // Prefill user information from localStorage if available
  try {
    const storedNombre = localStorage.getItem('nombreUsuario');
    const storedCorreo = localStorage.getItem('correoUsuario');
    if (storedNombre) matNombreUsuario.value = storedNombre;
    if (storedCorreo) matCorreoUsuario.value = storedCorreo;
  } catch (e) {}
});

// Regresar a la página unificada de solicitudes
backHomeMatBtn.addEventListener('click', () => {
  window.location.href = 'solicitudes.html';
});

// Search material
buscarMaterialBtn.addEventListener('click', () => {
  const mat = matBusqueda.value.trim();
  if (!mat) {
    toast('Por favor, ingrese o seleccione un material.', { type: 'error' });
    return;
  }
  currentMaterial = mat;
  showMaterialStep2(mat);
});

function resetMatStep2() {
  // No reiniciar matAccionSel aquí para mantener la selección actual
  matFormSolicitud.classList.add('hidden');
  matFormRegistro.classList.add('hidden');
  if (fpMatSolicitud) fpMatSolicitud.clear();
  if (fpMatRegistro) fpMatRegistro.clear();
  matCantidadSol.value = '';
  matCantidadReg.value = '';
  // Limpiar y ocultar actividad y descripción
  matActividad.value = '';
  matDescripcion.value = '';
  matActividadGroup.classList.add('hidden');
}

function showMaterialStep2(name) {
  matStep1.classList.add('hidden');
  matStep3.classList.add('hidden');
  matStep2.classList.remove('hidden');
  matNombreEl.textContent = name;
  const slug = slugify(name);
  setCatalogImage(matImgEl, { basePath: 'imagenes/material', slug });
  // Al abrir un nuevo material, limpiar la selección de acción y restablecer formularios
  matAccionSel.value = '';
  resetMatStep2();
}

// Select action for material
matAccionSel.addEventListener('change', () => {
  resetMatStep2();
  const action = matAccionSel.value;
  if (!action) return;
  // Mostrar grupo de actividad para ambas acciones
  matActividadGroup.classList.remove('hidden');
  if (action === 'Solicitud') {
    matFormSolicitud.classList.remove('hidden');
    fpMatSolicitud = flatpickr(matRango, { mode: 'range', dateFormat: 'd/m/Y' });
  } else if (action === 'Registro') {
    matFormRegistro.classList.remove('hidden');
    fpMatRegistro = flatpickr(matFechaUso, { dateFormat: 'd/m/Y' });
  }
});

// Cancel step2
matCancelStep2.addEventListener('click', () => {
  matStep2.classList.add('hidden');
  matStep1.classList.remove('hidden');
  matBusqueda.value = '';
});

// Add material
matAddBtn.addEventListener('click', () => {
  if (!processMaterial()) return;
  matStep2.classList.add('hidden');
  matStep1.classList.remove('hidden');
  matBusqueda.value = '';
});

// Finalize materials
matFinalizarBtn.addEventListener('click', () => {
  if (!processMaterial()) return;
  showMaterialStep3();
});

function processMaterial() {
  const action = matAccionSel.value;
  if (!action) {
    toast('Seleccione el tipo de accion.', { type: 'error' });
    return false;
  }
  if (action === 'Solicitud') {
    const rango = matRango.value;
    const cantidad = matCantidadSol.value;
    const act = matActividad.value;
    const desc = matDescripcion.value;
    if (!rango || !cantidad || !act || !desc) {
      toast('Complete rango, cantidad, actividad y descripcion.', { type: 'error' });
      return false;
    }
    let fechas = rango.split(/\s*(?:to|a)\s*/);
    const inicio = parseFechaMat(fechas[0]);
    const fin    = parseFechaMat(fechas[1] || fechas[0]);
    matCart.push({
      tipo: 'Solicitud de Insumos',
      insumo: currentMaterial,
      fechaSolicitudInsumos: inicio,
      fechaDevolucion: fin,
      cantidad: cantidad,
      actividad: act,
      descripcion: desc
    });
  } else if (action === 'Registro') {
    const fechaUso = matFechaUso.value;
    const cantidadReg = matCantidadReg.value;
    const act = matActividad.value;
    const desc = matDescripcion.value;
    if (!fechaUso || !cantidadReg || !act || !desc) {
      toast('Complete fecha de uso, cantidad, actividad y descripcion.', { type: 'error' });
      return false;
    }
    matCart.push({
      tipo: 'Uso de Insumos',
      insumo: currentMaterial,
      fechaUsoInsumos: parseFechaMat(fechaUso),
      cantidad: cantidadReg,
      actividad: act,
      descripcion: desc
    });
  }
  return true;
}

function showMaterialStep3() {
  matStep1.classList.add('hidden');
  matStep2.classList.add('hidden');
  // Build summary
  renderSummary_();
  matStep3.classList.remove('hidden');
}

function renderSummary_() {
  let html = '<ul class="summary-list">';
  matCart.forEach((item, idx) => {
    const title = escapeHtml_(item.insumo || '');
    let meta = '';
    if (item.tipo === 'Solicitud de Insumos') {
      meta = `Solicitud (${formatDate(item.fechaSolicitudInsumos)} a ${formatDate(item.fechaDevolucion)}) - Cantidad: ${escapeHtml_(item.cantidad)} - ${escapeHtml_(item.actividad || '')}`;
    } else {
      meta = `Registro el ${formatDate(item.fechaUsoInsumos)} - Cantidad: ${escapeHtml_(item.cantidad)} - ${escapeHtml_(item.actividad || '')}`;
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
  matResumenDiv.innerHTML = html;
}

matResumenDiv.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest ? e.target.closest('button[data-remove]') : null;
  if (!btn) return;
  const idx = Number(btn.dataset.remove);
  if (!Number.isFinite(idx)) return;
  matCart.splice(idx, 1);
  if (matCart.length === 0) {
    matStep3.classList.add('hidden');
    matStep1.classList.remove('hidden');
    toast('Carrito vacio. Agrega un material para continuar.', { type: 'info' });
    return;
  }
  renderSummary_();
});

// Back to search from summary
matBackToSearch.addEventListener('click', () => {
  matStep3.classList.add('hidden');
  matStep1.classList.remove('hidden');
});

// Send materials
matEnviarBtn.addEventListener('click', async () => {
  if (matCart.length === 0) {
    toast('No hay materiales para enviar.', { type: 'error' });
    return;
  }
  if (!validateRequired([matNombreUsuario, matCorreoUsuario])) {
    toast('Revisa los campos obligatorios.', { type: 'error' });
    return;
  }
  const payload = {
    nombre: matNombreUsuario.value,
    correo: matCorreoUsuario.value,
    observaciones: matObsUsuario.value || '',
    tipo: 'Material'
  };
  try {
    setButtonLoading(matEnviarBtn, true);
    const msg = await sendRequest(payload, matCart);
    toast(msg || 'Solicitud enviada correctamente', { type: 'success' });
    // Reset
    matCart = [];
    matNombreUsuario.value = '';
    matCorreoUsuario.value = '';
    matObsUsuario.value = '';
    // Después de enviar, redirigir a la página unificada de solicitudes
    window.location.href = 'solicitudes.html';
  } catch (err) {
    console.error(err);
    toast('Ocurrio un error al enviar la solicitud.', { type: 'error' });
  } finally {
    setButtonLoading(matEnviarBtn, false);
  }
});

// Helpers
function escapeHtml_(s) {
  return String(s || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}
function parseFechaMat(fechaStr) {
  const parts = fechaStr.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return fechaStr;
}
function formatDate(isoStr) {
  if (!isoStr) return '';
  const [y,m,d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
}
