/*
 * api.js
 *
 * Este módulo proporciona funciones auxiliares para interactuar
 * con el Web App de Google Apps Script. Implementa la lógica de
 * almacenamiento en caché de las listas (reactivos, equipos y materiales)
 * en localStorage con un TTL configurable, así como wrappers para
 * las llamadas de lectura (doGet) y escritura (doPost) del backend.
 *
 * Las funciones retornan Promesas, lo que facilita su uso con
 * async/await en el resto de páginas.  Para las operaciones que
 * requieren adjuntar archivos (p. ej. solicitud de reactivo
 * controlado), se lee el archivo como Base64 y se envía como
 * parte del FormData.
 */

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxHeeww1gD3CnF3ByEYONO-viEml98SV3P7r_W7YzquPemPzYqK5kt2DnTaph2ZzUA7NA/exec';

// TTL para las listas en milisegundos (12 horas)
const TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Obtiene una lista (reactivos, insumos o equipos) del backend o
 * del caché local.  Si la lista está almacenada en localStorage y
 * no ha expirado, se devuelve la versión en caché.  En caso
 * contrario, se consulta al Apps Script y se actualiza el caché.
 *
 * @param {string} listName Nombre de la acción (p.ej. 'listReactivos').
 * @returns {Promise<string[]>} Lista de nombres.
 */
export async function getList(listName) {
  const storageKey = `cache_${listName}`;
  const cached = localStorage.getItem(storageKey);
  if (cached) {
    try {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < TTL_MS && Array.isArray(data)) {
        return data;
      }
    } catch (e) {
      // Si hay error al parsear, se ignora y se refresca
    }
  }
  // Consulta al backend
  const url = new URL(WEB_APP_URL);
  url.searchParams.set('action', listName);
  const resp = await fetch(url);
  const data = await resp.json();
  if (Array.isArray(data)) {
    localStorage.setItem(storageKey, JSON.stringify({ ts: Date.now(), data }));
    return data;
  }
  return [];
}

/**
 * Consulta la disponibilidad de equipos para un rango de fechas.
 *
 * @param {string} start Fecha inicial en formato ISO (yyyy-mm-dd).
 * @param {string} end   Fecha final en formato ISO (yyyy-mm-dd).
 * @returns {Promise<string[]>} Lista de equipos disponibles.
 */
export async function getAvailableEquipos(start, end) {
  const url = new URL(WEB_APP_URL);
  url.searchParams.set('action', 'availEquipos');
  if (start) url.searchParams.set('start', start);
  if (end)   url.searchParams.set('end', end);
  const resp = await fetch(url);
  return resp.json();
}

/**
 * Obtiene un listado de ocupaciones para un equipo concreto.
 *
 * @param {string} equipo Nombre del equipo.
 * @returns {Promise<Array<{from: string, to: string}>>}
 */
export async function getBusyEquipos(equipo) {
  const url = new URL(WEB_APP_URL);
  url.searchParams.set('action', 'busyEquipos');
  url.searchParams.set('equipo', equipo);
  const resp = await fetch(url);
  return resp.json();
}

/**
 * Envía una solicitud al backend para crear uno o varios registros.
 *
 * Esta función admite dos modos:
 * 1. Envío único (forma tradicional) pasando un objeto `payload` que
 *    se enviará tal cual a `doPost`.  Se utiliza cuando `items` es
 *    nulo o una lista vacía.
 * 2. Envío múltiple: se pasa un objeto `payload` con los campos
 *    generales (nombre, correo, fecha, observaciones, etc.) y un
 *    array `items` con objetos individuales (equipos, materiales,
 *    reactivos).  Se serializa el array a JSON y se envía en el
 *    parámetro `items`.  El Apps Script debe detectar este parámetro
 *    y procesar cada elemento por separado.
 *
 * Para adjuntar un archivo (caso de reactivos controlados), pase
 * `file` como instancia de File.  El archivo se convertirá a
 * Base64 y se enviará en los campos `fileName` y `fileBase64`.
 *
 * @param {Object} payload Datos generales a enviar.
 * @param {Array<Object>} items Lista de elementos.
 * @param {File|null} file Archivo opcional.
 * @returns {Promise<string>} Respuesta en texto plano del backend.
 */
export async function sendRequest(payload, items = [], file = null) {
  const formData = new FormData();
  // Añadir campos del payload
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null) formData.append(k, v);
  });
  // Añadir lista serializada si existen items
  if (items && Array.isArray(items) && items.length > 0) {
    formData.append('items', JSON.stringify(items));
  }
  // Adjuntar archivo si lo hay
  if (file) {
    const b64 = await toBase64(file);
    formData.append('fileName', file.name);
    // Enviar mimeType para que el backend guarde el blob correctamente
    formData.append('fileMimeType', file.type || 'application/pdf');
    formData.append('fileBase64', b64);
  }
  const resp = await fetch(WEB_APP_URL, {
    method: 'POST',
    body: formData
  });
  return resp.text();
}

/**
 * Convierte un objeto File a Base64 (sin prefijo data:).
 * @param {File} file
 * @returns {Promise<string>}
 */
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // El resultado viene con el prefijo data:mime;base64,
      // separamos para quedarnos solo con la parte Base64.
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
