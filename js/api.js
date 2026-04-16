/*
 * api.js - LPN
 *
 * Soporta dos modos:
 * 1) Online: usando un Web App de Google Apps Script.
 * 2) Local/demo: cargando catalogos desde /data/*.json mientras el backend
 *    definitivo se despliega.
 */

export const WEB_APP_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbxHeeww1gD3CnF3ByEYONO-viEml98SV3P7r_W7YzquPemPzYqK5kt2DnTaph2ZzUA7NA/exec';
const TTL_MS = 12 * 60 * 60 * 1000;
const LOCAL_MAP = {
  listReactivos: 'data/reactivos.json',
  listEquipos: 'data/equipos.json',
  listInsumos: 'data/materiales.json'
};

export function getWebAppUrl() {
  try {
    const v = localStorage.getItem('webAppUrl');
    if (v && /^https:\/\//i.test(v)) return v;
  } catch (_) {}
  return WEB_APP_URL_DEFAULT;
}

export function setWebAppUrl(nextUrl) {
  const v = String(nextUrl || '').trim();
  if (!v) {
    try { localStorage.removeItem('webAppUrl'); } catch (_) {}
    return;
  }
  if (!/^https:\/\//i.test(v)) throw new Error('URL invalida. Debe iniciar con https://');
  try { localStorage.setItem('webAppUrl', v); } catch (_) {}
}

export async function getList(listName) {
  const storageKey = `cache_${listName}`;
  const cached = getCached_(storageKey);
  if (cached) return cached;

  try {
    const data = await safeGetJson_({ action: listName });
    if (Array.isArray(data)) {
      setCached_(storageKey, data);
      return data;
    }
  } catch (_) {}

  const local = await getLocalList_(listName);
  setCached_(storageKey, local);
  return local;
}

export async function getAvailableEquipos(start, end) {
  try {
    return await safeGetJson_({ action: 'availEquipos', start, end });
  } catch (_) {
    return getList('listEquipos');
  }
}

export async function getBusyEquipos(equipo) {
  try {
    return await safeGetJson_({ action: 'busyEquipos', equipo });
  } catch (_) {
    return [];
  }
}

export async function sendRequest(payload, items = [], file = null) {
  const url = getWebAppUrl();
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) formData.append(k, v);
  });
  if (items && Array.isArray(items) && items.length > 0) {
    formData.append('items', JSON.stringify(items));
  }
  if (file) {
    const b64 = await toBase64(file);
    formData.append('fileName', file.name);
    formData.append('fileMimeType', file.type || 'application/pdf');
    formData.append('fileBase64', b64);
  }

  if (url) {
    const resp = await fetch(url, { method: 'POST', body: formData });
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(text || `Error del servidor (${resp.status})`);
    }
    if (!String(text || '').trim()) {
      throw new Error('El Web App no devolvio una respuesta valida.');
    }
    return text;
  }

  saveLocalSubmission_(payload, items);
  return 'Solicitud guardada localmente en el navegador. Falta conectar el Apps Script/Web App definitivo.';
}

export async function getStats(opts = {}) {
  return safeGetJson_({ action: 'stats', range: opts?.range || 'day' });
}

export async function getAgenda(days = 14) {
  return safeGetJson_({ action: 'agenda', days: String(days) });
}

export async function getDashboard() {
  return safeGetJson_({ action: 'dashboard' });
}

async function safeGetJson_(params) {
  const base = getWebAppUrl();
  if (!base) throw new Error('Web App no configurado');
  const url = new URL(base);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  try {
    const resp = await fetch(url);
    const text = await resp.text();
    return JSON.parse(text);
  } catch (_) {
    return jsonp_(params);
  }
}

function jsonp_(params) {
  return new Promise((resolve, reject) => {
    const base = getWebAppUrl();
    if (!base) return reject(new Error('Web App no configurado'));
    const cb = `__jsonp_${Math.random().toString(36).slice(2)}`;
    const url = new URL(base);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
    url.searchParams.set('callback', cb);
    url.searchParams.set('_t', String(Date.now()));

    const script = document.createElement('script');
    script.async = true;
    script.src = url.toString();

    const cleanup = () => {
      try { delete window[cb]; } catch (_) { window[cb] = undefined; }
      script.remove();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 12000);

    window[cb] = (data) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('JSONP network error'));
    };

    document.head.appendChild(script);
  });
}

async function getLocalList_(listName) {
  const file = LOCAL_MAP[listName];
  if (!file) return [];
  const resp = await fetch(file);
  const data = await resp.json();
  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === 'object') {
      return data.map(item => item.nombre || item.name || '').filter(Boolean);
    }
    return data;
  }
  return [];
}

function getCached_(storageKey) {
  try {
    const cached = localStorage.getItem(storageKey);
    if (!cached) return null;
    const { ts, data } = JSON.parse(cached);
    if (Date.now() - ts < TTL_MS && Array.isArray(data)) return data;
  } catch (_) {}
  return null;
}

function setCached_(storageKey, data) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {}
}

function saveLocalSubmission_(payload, items) {
  try {
    const key = 'lpn_pending_submissions';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({
      createdAt: new Date().toISOString(),
      payload: payload || {},
      items: Array.isArray(items) ? items : []
    });
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (_) {}
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(String(result).split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
