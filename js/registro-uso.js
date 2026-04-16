import { sendRequest } from './api.js';
import { toast, setButtonLoading, validateRequired } from './ui-kit.js';

// Elementos del formulario y pasos
const form = document.getElementById('registroForm');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');
const tipoSelect = document.getElementById('tipoRegistro');
const contenedorTipo = document.getElementById('contenedorTipo');
const legend2 = document.getElementById('legend-2');

// Botones de navegación
const cancelBtn = document.getElementById('cancelBtn');
const next1Btn  = document.getElementById('next1Btn');
const back2Btn  = document.getElementById('back2Btn');
const next2Btn  = document.getElementById('next2Btn');
const back3Btn  = document.getElementById('back3Btn');

// Date/Time pickers
let horaInicialPicker = null;
let horaFinalPicker   = null;
let fechaPicker       = null;

// Paso actual
let currentStep = 1;

// Prefill general information from localStorage if available
window.addEventListener('load', () => {
  try {
    const storedNombre = localStorage.getItem('nombreUsuario');
    const storedCorreo = localStorage.getItem('correoUsuario');
    if (storedNombre) {
      const nombreEl = document.getElementById('nombre');
      if (nombreEl) nombreEl.value = storedNombre;
    }
    if (storedCorreo) {
      const correoEl = document.getElementById('correo');
      if (correoEl) correoEl.value = storedCorreo;
    }
  } catch (e) {}
});

// Configurar cancelación: volver al inicio (index.html)
cancelBtn.addEventListener('click', () => {
  // Volver a la página unificada de solicitudes en lugar de al inicio
  window.location.href = 'solicitudes.html';
});

// Siguiente desde paso 1
next1Btn.addEventListener('click', () => {
  if (!tipoSelect.value) {
    toast('Por favor, seleccione un tipo de registro.', { type: 'error' });
    return;
  }
  buildStep2(tipoSelect.value);
  goToStep(2);
});

// Volver desde paso 2
back2Btn.addEventListener('click', () => {
  goToStep(1);
});

// Siguiente desde paso 2
next2Btn.addEventListener('click', () => {
  // Validar campos obligatorios de paso 2
  const inputs = Array.from(contenedorTipo.querySelectorAll('input, select'));
  if (!validateRequired(inputs)) {
    toast('Por favor, complete todos los campos requeridos.', { type: 'error' });
    return;
  }
  goToStep(3);
});

// Volver desde paso 3
back3Btn.addEventListener('click', () => {
  goToStep(2);
});

// Envío del formulario
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  // Validar campos de paso 3
  const nombre = document.getElementById('nombre');
  const fecha  = document.getElementById('fecha');
  const correo = document.getElementById('correo');
  if (!validateRequired([nombre, fecha, correo])) {
    toast('Por favor, complete los campos generales.', { type: 'error' });
    return;
  }
  // Crear payload
  const tipo = tipoSelect.value;
  const payload = {
    nombre: nombre.value,
    correo: correo.value,
    observaciones: document.getElementById('observaciones').value || '',
    fecha: parseFecha(fecha.value),
    // El campo tipo lo mapeamos a la denominación esperada en el backend
    tipo: mapTipoToBackend(tipo)
  };
  // Añadir campos específicos según tipo
  switch (tipo) {
    case 'Practica': {
      payload.asignatura  = document.getElementById('ru_asignatura').value;
      payload.horaInicialProf = document.getElementById('ru_horaInicial').value;
      payload.horaFinalProf   = document.getElementById('ru_horaFinal').value;
      payload.cedula     = document.getElementById('ru_cedula').value;
      break;
    }
    case 'Pasantia': {
      payload.horas = document.getElementById('ru_horas').value;
      payload.actividadRealizada = document.getElementById('ru_actividadPasantia').value;
      break;
    }
    case 'Tesis': {
      payload.actividad = document.getElementById('ru_actividadSelect').value;
      payload.actividadRealizada = document.getElementById('ru_actividadRealizada').value;
      payload.tipoActividadRealizada = document.getElementById('ru_tipoPersona').value;
      payload.nombreProyecto = document.getElementById('ru_nombreProyecto').value;
      break;
    }
  }
  try {
    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);
    const msg = await sendRequest(payload);
    toast(msg || 'Registro enviado correctamente', { type: 'success' });
    // Reset form y volver al inicio
    form.reset();
    goToStep(1);
    // Después de enviar, redirigir a la página unificada de solicitudes
    window.location.href = 'solicitudes.html';
  } catch (err) {
    console.error(err);
    toast('Error al enviar el registro.', { type: 'error' });
  } finally {
    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, false);
  }
});

/**
 * Mapea los valores internos del combo a los valores que entiende el backend.
 *
 * @param {string} tipo Valor interno seleccionado.
 * @returns {string} Valor textual para el backend.
 */
function mapTipoToBackend(tipo) {
  switch (tipo) {
    case 'Practica': return 'Práctica de lab o Cátedra';
    case 'Pasantia': return 'Pasantías';
    case 'Tesis': return 'Tesis/Proyectos';
    default: return tipo;
  }
}

/**
 * Convierte una fecha dd/mm/yyyy a formato ISO (yyyy-MM-dd).
 * Si no se reconoce, devuelve la cadena original.
 *
 * @param {string} dateStr
 * @returns {string}
 */
function parseFecha(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dateStr;
}

/**
 * Construye los campos dinámicos del paso 2 según el tipo de registro.
 * Limpia el contenedor y agrega los inputs con sus atributos.
 *
 * @param {string} tipo
 */
function buildStep2(tipo) {
  contenedorTipo.innerHTML = '';
  // Destruir pickers previos si existen
  if (horaInicialPicker) { horaInicialPicker.destroy(); horaInicialPicker = null; }
  if (horaFinalPicker)   { horaFinalPicker.destroy(); horaFinalPicker   = null; }
  if (fechaPicker)       { fechaPicker.destroy(); fechaPicker       = null; }
  switch (tipo) {
    case 'Practica': {
      legend2.textContent = 'Detalles de Práctica/Cátedra';
      contenedorTipo.innerHTML = `
        <label for="ru_asignatura">Asignatura</label>
        <input type="text" id="ru_asignatura" required aria-required="true" placeholder="Asignatura">
        <label for="ru_horaInicial">Hora inicial</label>
        <input type="text" id="ru_horaInicial" required aria-required="true" placeholder="HH:MM">
        <label for="ru_horaFinal">Hora final</label>
        <input type="text" id="ru_horaFinal" required aria-required="true" placeholder="HH:MM">
        <label for="ru_cedula">Cédula</label>
        <input type="text" id="ru_cedula" required aria-required="true" placeholder="Cédula">
      `;
      // Configurar pickers de hora
      horaInicialPicker = flatpickr('#ru_horaInicial', { enableTime: true, noCalendar: true, dateFormat: 'H:i' });
      horaFinalPicker   = flatpickr('#ru_horaFinal',   { enableTime: true, noCalendar: true, dateFormat: 'H:i' });
      break;
    }
    case 'Pasantia': {
      legend2.textContent = 'Detalles de Pasantía';
      contenedorTipo.innerHTML = `
        <label for="ru_horas">Horas</label>
        <input type="number" id="ru_horas" required aria-required="true" min="0" placeholder="Número de horas">
        <label for="ru_actividadPasantia">Actividad realizada</label>
        <input type="text" id="ru_actividadPasantia" required aria-required="true" placeholder="Actividad realizada">
      `;
      break;
    }
    case 'Tesis': {
      legend2.textContent = 'Detalles de Tesis/Proyectos';
      contenedorTipo.innerHTML = `
        <label for="ru_actividadSelect">Actividad</label>
        <select id="ru_actividadSelect" required aria-required="true">
          <option value="">– selecciona –</option>
          <option value="Proyecto">Proyecto</option>
          <option value="Tesis">Tesis</option>
        </select>
        <label for="ru_actividadRealizada">Actividad realizada</label>
        <input type="text" id="ru_actividadRealizada" required aria-required="true" placeholder="Actividad realizada">
        <label for="ru_tipoPersona">Tipo de persona</label>
        <select id="ru_tipoPersona" required aria-required="true">
          <option value="">– selecciona –</option>
          <option value="Estudiante">Estudiante</option>
          <option value="Investigador">Investigador</option>
        </select>
        <label for="ru_nombreProyecto">Nombre del proyecto/tesis</label>
        <input type="text" id="ru_nombreProyecto" required aria-required="true" placeholder="Nombre del proyecto o tesis">
      `;
      break;
    }
  }
}

/**
 * Cambia de paso visible.
 * @param {number} step
 */
function goToStep(step) {
  currentStep = step;
  step1.classList.toggle('active', step === 1);
  step2.classList.toggle('active', step === 2);
  step3.classList.toggle('active', step === 3);
  // Cuando llegamos al paso 3, inicializar selector de fecha si no existe
  if (step === 3 && !fechaPicker) {
    fechaPicker = flatpickr('#fecha', { dateFormat: 'd/m/Y' });
  }
}
