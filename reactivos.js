import { getList, sendRequest } from './api.js';

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

// Go back home
backHomeReact.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// Search reactivo
buscarReactivoBtn.addEventListener('click', () => {
  const r = reacBusqueda.value.trim();
  if (!r) {
    alert('Por favor, ingrese o seleccione un reactivo.');
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
  reacImgEl.src = `imagenes/reactivos/${slug}.jpg`;
  reacImgEl.onerror = () => {
    reacImgEl.src = 'placeholder_light_gray_block.png';
  };
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
    alert('Seleccione el tipo de acción.');
    return false;
  }
  const cantidad = reacCantidad.value;
  let unidad = reacUnidad.value;
  const unidadOtro = reacUnidadOtro.value;
  if (!cantidad || !unidad || (unidad === 'otro' && !unidadOtro)) {
    alert('Ingrese la cantidad y la unidad.');
    return false;
  }
  if (unidad === 'otro') unidad = unidadOtro;
  const controlado = reacControlado.checked;
  const file = reacFile.files[0] || null;
  if (controlado && !file) {
    alert('Debe subir el archivo de solicitud para reactivos controlados.');
    return false;
  }
  if (action === 'Solicitud') {
    const labDestino = reacLabDestino.value;
    if (!labDestino) {
      alert('Indique el laboratorio de destino.');
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
  let html = '<ul>';
  reacCart.forEach((item, idx) => {
    const controlled = item.controlado ? ' (controlado)' : '';
    if (item.tipo === 'Solicitud de Reactivos') {
      html += `<li><strong>${idx + 1}. ${item.reactivo}</strong> – Solicitud, Cantidad: ${item.cantidad}${controlled}, Destino: ${item.laboratorioDestino}</li>`;
    } else {
      html += `<li><strong>${idx + 1}. ${item.reactivo}</strong> – Registro, Cantidad: ${item.cantidad}${controlled}</li>`;
    }
  });
  html += '</ul>';
  reacResumenDiv.innerHTML = html;
  // Initialize date picker for fecha if not yet done
  if (!fpFechaGeneral) {
    fpFechaGeneral = flatpickr(reacFecha, { dateFormat: 'd/m/Y' });
    // Default to today
    const today = new Date();
    fpFechaGeneral.setDate(today, true);
  }
  reacStep3.classList.remove('hidden');
}

// Back to search from summary
reacBackToSearch.addEventListener('click', () => {
  reacStep3.classList.add('hidden');
  reacStep1.classList.remove('hidden');
});

// Send all reactivos
reacEnviarBtn.addEventListener('click', async () => {
  if (reacCart.length === 0) {
    alert('No hay reactivos para enviar.');
    return;
  }
  if (!reacNombreUsuario.value || !reacCorreoUsuario.value || !reacTipoAct.value || !reacNombreAct.value) {
    alert('Complete todos los campos de la sección general.');
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
    const msg = await sendRequest(payload, reacCart.map(item => {
      const obj = { tipo: item.tipo, reactivo: item.reactivo, cantidad: item.cantidad };
      if (item.tipo === 'Solicitud de Reactivos') {
        obj.laboratorioDestino = item.laboratorioDestino;
      }
      obj.controlado = item.controlado;
      return obj;
    }), attachFile);
    alert(msg || 'Solicitud enviada correctamente');
    reacCart = [];
    // Reset summary form fields
    reacNombreUsuario.value = '';
    reacCorreoUsuario.value = '';
    reacTipoAct.value = '';
    reacNombreAct.value = '';
    reacStep3.classList.add('hidden');
    reacStep1.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('Ocurrió un error al enviar la solicitud.');
  }
});

// Helpers
function slugify(str) {
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function parseFechaReac(fechaStr) {
  const parts = fechaStr.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return fechaStr;
}