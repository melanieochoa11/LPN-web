import { getList, getBusyEquipos, sendRequest } from './api.js';

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
const ocupacionInfo   = document.getElementById('ocupacionInfo');
const registroFecha   = document.getElementById('registroFecha');
// Nuevo grupo de actividad que se muestra para Solicitud y Registro
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
  window.location.href = 'index.html';
});

// Buscar equipo
buscarEquipoBtn.addEventListener('click', () => {
  const eq = equipoBusqueda.value.trim();
  if (!eq) {
    alert('Por favor, ingrese o seleccione un equipo.');
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
  if (fpSolicitud) { fpSolicitud.clear(); }
  if (fpRegistro) { fpRegistro.clear(); }
  // Limpiar campos de actividad
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
  equipoImgEl.src = `imagenes/equipos/${slug}.jpg`;
  equipoImgEl.onerror = () => {
    equipoImgEl.src = 'placeholder_light_gray_block.png';
  };
  // Al abrir un nuevo equipo, limpiar la selección y restablecer formularios
  equipoAccionSel.value = '';
  resetStep2();
}

// Action selection
equipoAccionSel.addEventListener('change', async () => {
  const action = equipoAccionSel.value;
  resetStep2();
  if (!action) return;
  // Mostrar grupo de actividad para ambas acciones
  equipoActividadGroup.classList.remove('hidden');
  if (action === 'Solicitud') {
    formSolicitudDiv.classList.remove('hidden');
    // Initialize flatpickr with range plugin
    fpSolicitud = flatpickr(solicitudRango, {
      mode: 'range',
      dateFormat: 'd/m/Y',
      onClose: async (selectedDates) => {
        // Restablecer banderas
        solicitudConflicto = false;
        currentBusyIntervals = [];
        if (selectedDates.length === 2) {
          const [start, end] = selectedDates;
          // Cargar rangos ocupados para el equipo y almacenarlos globalmente
          const busy = await getBusyEquipos(currentEquipo);
          if (Array.isArray(busy) && busy.length > 0) {
            currentBusyIntervals = busy;
            // Mostrar intervalos ocupados
            ocupacionInfo.innerHTML = '<strong>Ocupado en:</strong> ' + busy.map(b => `${formatDate(b.from)} – ${formatDate(b.to)}`).join(', ');
            // Convertir fechas seleccionadas a formato ISO para comparación
            const selInicio = new Date(start).toISOString().split('T')[0];
            const selFin    = new Date(end).toISOString().split('T')[0];
            // Comprobar solapamientos: si cualquier ocupación intersecta con las fechas seleccionadas
            for (const intervalo of busy) {
              const ocInicio = intervalo.from;
              const ocFin    = intervalo.to;
              // Si los intervalos se cruzan
              if (selFin >= ocInicio && selInicio <= ocFin) {
                solicitudConflicto = true;
                break;
              }
            }
          } else {
            ocupacionInfo.textContent = '';
          }
        }
        // Si hay conflicto, informar al usuario
        if (solicitudConflicto) {
          alert('El equipo está ocupado en al menos una de las fechas seleccionadas. Por favor, elija otro rango.');
        }
      }
    });
  } else if (action === 'Registro') {
    formRegistroDiv.classList.remove('hidden');
    // Initialize single date picker
    fpRegistro = flatpickr(registroFecha, { dateFormat: 'd/m/Y' });
  }
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

// Finalize
finalizarEquipoBtn.addEventListener('click', () => {
  if (!processCurrentEquipo()) return;
  showStep3();
});

// Process current equipo into cart. Returns false if validation fails.
function processCurrentEquipo() {
  const action = equipoAccionSel.value;
  if (!action) {
    alert('Seleccione el tipo de acción para el equipo.');
    return false;
  }
  if (action === 'Solicitud') {
    const rango = solicitudRango.value;
    if (!rango) {
      alert('Seleccione el rango de uso.');
      return false;
    }
    let fechas = rango.split(/\s*(?:to|a)\s*/);
    if (fechas.length < 2) {
      fechas = rango.split(' ');
    }
    const inicio = parseFechaEquipo(fechas[0]);
    const fin    = parseFechaEquipo(fechas[1] || fechas[0]);
    const act = equipoActividad.value;
    const desc = equipoDescripcion.value;
    if (!act || !desc) {
      alert('Seleccione la actividad y describa lo que se realizará.');
      return false;
    }
    // Verificar si las fechas seleccionadas se superponen con intervalos ocupados
    if (solicitudConflicto) {
      alert('El equipo está ocupado en las fechas seleccionadas. No es posible registrar la solicitud.');
      return false;
    }
    cart.push({
      tipo: 'Solicitud de Equipos',
      equipo: currentEquipo,
      fechaInicial: inicio,
      fechaFinal: fin,
      actividad: act,
      descripcion: desc
    });
  } else if (action === 'Registro') {
    const fechaUso = registroFecha.value;
    const act = equipoActividad.value;
    const desc = equipoDescripcion.value;
    if (!fechaUso || !act || !desc) {
      alert('Complete la fecha de uso, la actividad y la descripción.');
      return false;
    }
    cart.push({
      tipo: 'Uso de equipo',
      equipo: currentEquipo,
      fechaUsoEquipo: parseFechaEquipo(fechaUso),
      actividad: act,
      descripcion: desc
    });
  }
  return true;
}

// Show summary step
function showStep3() {
  step1.classList.add('hidden');
  step2.classList.add('hidden');
  // Build summary list
  let html = '<ul>';
  cart.forEach((item, idx) => {
    if (item.tipo === 'Solicitud de Equipos') {
      html += `<li><strong>${idx + 1}. ${item.equipo}</strong> – Solicitud (${formatDate(item.fechaInicial)} a ${formatDate(item.fechaFinal)}) – <em>${item.actividad}</em></li>`;
    } else {
      html += `<li><strong>${idx + 1}. ${item.equipo}</strong> – Registro el ${formatDate(item.fechaUsoEquipo)} – <em>${item.actividad}</em></li>`;
    }
  });
  html += '</ul>';
  summaryDiv.innerHTML = html;
  step3.classList.remove('hidden');
}

// Back to search from summary
backToSearchBtn.addEventListener('click', () => {
  step3.classList.add('hidden');
  step1.classList.remove('hidden');
});

// Send all equipos
enviarEquiposBtn.addEventListener('click', async () => {
  if (cart.length === 0) {
    alert('No hay equipos para enviar.');
    return;
  }
  if (!nombreUsuario.value || !correoUsuario.value) {
    alert('Ingrese su nombre y correo institucional.');
    return;
  }
  const payload = {
    nombre: nombreUsuario.value,
    correo: correoUsuario.value,
    observaciones: observaciones.value || '',
    tipo: 'Equipos'
  };
  try {
    const msg = await sendRequest(payload, cart);
    alert(msg || 'Solicitud enviada correctamente');
    // Reset everything
    cart = [];
    nombreUsuario.value = '';
    correoUsuario.value = '';
    observaciones.value = '';
    step3.classList.add('hidden');
    step1.classList.remove('hidden');
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