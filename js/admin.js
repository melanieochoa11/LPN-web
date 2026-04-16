import { toast, setButtonLoading } from './ui-kit.js';
import { getWebAppUrl, setWebAppUrl, getDashboard } from './api.js';

// Client-side gate only (not real security)
const ADMIN_PASSCODE = 'cambiar-esto';

const statusEl = document.getElementById('adminStatus');
const refreshBtn = document.getElementById('adminRefresh');
const configBtn = document.getElementById('adminConfig');
const errorEl = document.getElementById('adminError');

const charts = {};

document.addEventListener('DOMContentLoaded', () => {
  if (!ensureAdmin_()) return;
  bindUi_();
  load_();
});

function bindUi_() {
  refreshBtn.addEventListener('click', () => load_());
  if (configBtn) {
    configBtn.addEventListener('click', () => {
      const current = getWebAppUrl();
      const next = window.prompt(
        'Pega aqui la URL del Web App de Apps Script (termina en /exec).\n\nDeja vacio para volver al valor por defecto.',
        current
      );
      if (next === null) return;
      try {
        setWebAppUrl(next);
        toast('Configuración guardada.', { type: 'success' });
        load_();
      } catch (e) {
        toast(e.message || 'URL inválida', { type: 'error' });
      }
    });
  }
}

async function load_() {
  setButtonLoading(refreshBtn, true, 'Actualizando...');
  setStatus_('Conectando...', 'info');
  clearError_();
  try {
    const data = await getDashboard();
    if (!data || typeof data !== 'object') throw new Error('Respuesta no válida');

    renderKpis_(data.kpis || {});
    renderTimeline_(data.timeline_monthly || {});
    renderResources_(data.resource_status || {}, data.kpis || {});
    renderUsers_(data.users_activity || {});
    renderRecent_(data.recent_events || {});

    setStatus_('Conectado', 'success');
  } catch (e) {
    console.error(e);
    setStatus_('Sin conexión', 'error');
    showError_('No se pudo cargar el dashboard.', e);
    toast('No se pudo cargar el dashboard.', { type: 'error' });
  } finally {
    setButtonLoading(refreshBtn, false);
  }
}

function renderKpis_(k) {
  setNum_('kpiTotalRequests', k.total_requests);
  setNum_('kpiEquipmentInUseNow', k.equipment_in_use_now);
  setNum_('kpiReagentsUseEvents', k.reagents_use_events);
  setNum_('kpiSuppliesActiveNow', k.supplies_active_now);
  setNum_('kpiUniqueUsers30d', k.unique_users_30d);
}

function renderTimeline_(t) {
  const labels = t.labels || [];
  const series = [t.REQUEST_EQUIPMENT, t.REQUEST_REAGENT, t.REQUEST_SUPPLY, t.USE_EQUIPMENT, t.USE_REAGENT, t.LAB_USAGE, t.total_monthly];
  if (!hasMeaningfulSeries_(series)) {
    showCanvasEmpty_('chartOperational', 'Aún no hay suficiente historial para mostrar la evolución mensual.');
    destroyChart_('chartOperational');
    return;
  }
  clearCanvasEmpty_('chartOperational');
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('chartOperational');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  destroyChart_('chartOperational');

  charts.chartOperational = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        mkStack_('Solicitudes de equipos', t.REQUEST_EQUIPMENT, '#1f77b4'),
        mkStack_('Solicitudes de reactivos', t.REQUEST_REAGENT, '#ff7f0e'),
        mkStack_('Solicitudes de insumos', t.REQUEST_SUPPLY, '#2ca02c'),
        mkStack_('Usos de equipos', t.USE_EQUIPMENT, '#9467bd'),
        mkStack_('Usos de reactivos', t.USE_REAGENT, '#e377c2'),
        mkStack_('Uso de laboratorio', t.LAB_USAGE, '#17becf'),
        {
          type: 'line',
          label: 'Total mensual',
          data: t.total_monthly || [],
          borderColor: '#0b1f3a',
          backgroundColor: 'rgba(11, 31, 58, 0.08)',
          tension: 0,
          fill: false,
          pointRadius: 0,
          borderWidth: 2,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: 'rgba(0,29,58,0.76)' } } },
      scales: {
        x: { stacked: true, ticks: { color: 'rgba(0,29,58,0.60)' }, grid: { color: 'rgba(0,29,58,0.10)' } },
        y: { stacked: true, ticks: { color: 'rgba(0,29,58,0.60)' }, grid: { color: 'rgba(0,29,58,0.10)' } },
      }
    }
  });
}

function renderResources_(r, kpis) {
  const equipment = r.equipment || {};
  const eqStatus = equipment.status_counts || {};
  setNum_('equiposInUseNow', equipment.in_use_now);
  setNum_('equiposReserved', eqStatus.reserved);
  const available = equipment.available_now;
  const elAvail = document.getElementById('equiposAvailable');
  if (elAvail) elAvail.textContent = (available === null || available === undefined) ? '—' : formatNumber_(available);
  const statusSummary = document.getElementById('equiposStatusSummary');
  if (statusSummary) {
    const free = eqStatus.free;
    statusSummary.textContent = `Uso ${formatNumber_(eqStatus.in_use)} · Reserva ${formatNumber_(eqStatus.reserved)} · Libre ${free === null || free === undefined ? '—' : formatNumber_(free)}`;
  }

  renderPie_('chartEquiposStatus', [Number(eqStatus.in_use) || 0, Number(eqStatus.reserved) || 0, Number(eqStatus.free) || 0], ['En uso', 'Reservado', 'Libre'], ['#ef4444', '#f59e0b', '#22c55e'], 'chartEquiposStatus', 'Aún no hay suficiente información para calcular estados de equipos.');
  renderHBar_('chartEquiposRequested', equipment.top_requested || [], '#1f77b4', 'chartEquiposRequested', '', 'Todavía no hay solicitudes de equipos para comparar.');
  renderHBar_('chartEquiposUsed', equipment.top_used || [], '#9467bd', 'chartEquiposUsed', '', 'Todavía no hay registros de uso de equipos.');

  const used = (kpis && kpis.reagents_consumed) ? kpis.reagents_consumed : {};
  const req = (kpis && kpis.reagents_requested) ? kpis.reagents_requested : {};
  setNum_('reagUsedG', used.total_mass_g);
  setNum_('reagUsedML', used.total_volume_mL);
  setNum_('reagReqG', req.total_mass_g);
  setNum_('reagReqML', req.total_volume_mL);

  const badge = document.getElementById('reagUnknownBadge');
  const unk = (Number(used.unknown_used_events) || 0) + (Number(req.unknown_requested_events) || 0);
  if (badge) {
    if (unk > 0) {
      badge.hidden = false;
      badge.textContent = `${unk} registros con unidad no reconocida`;
    } else {
      badge.hidden = true;
    }
  }

  const reagents = r.reagents || {};
  renderHBar_('chartReactivosConsumedMass', reagents.top_consumed_by_mass_g || [], '#e377c2', 'chartReactivosConsumedMass', 'g', 'Aún no hay consumos de reactivos medidos en gramos.');
  renderHBar_('chartReactivosConsumedVol', reagents.top_consumed_by_volume_mL || [], '#ff7f0e', 'chartReactivosConsumedVol', 'mL', 'Aún no hay consumos de reactivos medidos en mL.');
  renderHBar_('chartReactivosRequestedVol', reagents.top_requested_by_volume_mL || [], '#17becf', 'chartReactivosRequestedVol', 'mL', 'Aún no hay solicitudes de reactivos medidas en mL.');
  renderReagentsTable_(reagents.totals_by_reagent || []);

  const supplies = r.supplies || {};
  setNum_('insumosActive', supplies.active_now);
  setNum_('insumosTopCount', (supplies.top_lent || []).length);
  renderHBar_('chartInsumosTop', supplies.top_lent || [], '#2ca02c', 'chartInsumosTop', '', 'Aún no hay suficientes movimientos de insumos para mostrar un ranking.');
}

function renderReagentsTable_(rows) {
  const tbody = document.getElementById('reagentsTableBody');
  if (!tbody) return;
  if (!(rows || []).length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Aún no hay datos de reactivos para mostrar.</td></tr>';
    return;
  }
  tbody.innerHTML = (rows || []).map(r => {
    const used = r.used || {};
    const requested = r.requested || {};
    return `
      <tr>
        <td>${esc_(r.reagent_display_name || r.key || '')}</td>
        <td>${fmtMaybe_(used.mass_g)}</td>
        <td>${fmtMaybe_(used.volume_mL)}</td>
        <td>${fmtMaybe_(requested.mass_g)}</td>
        <td>${fmtMaybe_(requested.volume_mL)}</td>
        <td>${formatNumber_(used.events)}</td>
      </tr>
    `;
  }).join('');
}

function renderUsers_(u) {
  const rows = u.rows || [];
  const tbody = document.getElementById('userTableBody');
  if (tbody) {
    if (!rows.length) tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Todavía no hay actividad de usuarios suficiente para mostrar aquí.</td></tr>';
    else {
      tbody.innerHTML = rows.map(r => `
        <tr>
          <td>${esc_(r.name)}</td>
          <td>${esc_(r.email || '')}</td>
          <td>${formatNumber_(r.total_requests)}</td>
          <td>${formatNumber_(r.use_equipment)}</td>
          <td>${formatNumber_(r.use_reagent)}</td>
          <td>${esc_(r.last_activity || '')}</td>
        </tr>
      `).join('');
    }
  }
  renderHBar_('chartUsersTop', u.top10 || [], '#0b1f3a', 'chartUsersTop', '', 'Todavía no hay suficientes usuarios para comparar actividad.');
}

function renderRecent_(r) {
  const items = r.items || [];
  const wrap = document.getElementById('recentEvents');
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = '<div class="empty-block">No hay eventos recientes todavía.</div>';
    return;
  }
  wrap.innerHTML = items.map(ev => {
    const icon = iconFor_(ev.event_type);
    const title = `${labelFor_(ev.event_type)}${ev.status ? ' - ' + niceStatus_(ev.status) : ''}`;
    const who = [ev.user_name, ev.user_email].filter(Boolean).join(' - ');
    const sub = [who, ev.resource_name].filter(Boolean).join(' | ');
    return `
      <div class="event">
        <div class="icon" aria-hidden="true">${icon}</div>
        <div>
          <div class="title">${esc_(title)}</div>
          <div class="sub">${esc_(sub)}</div>
        </div>
        <div class="date">${esc_(ev.date_start || '')}</div>
      </div>
    `;
  }).join('');
}

function mkStack_(label, data, color) {
  return { type: 'bar', label, data: data || [], backgroundColor: hexToRgba_(color, 0.35), borderColor: color, borderWidth: 1, barPercentage: 0.9, categoryPercentage: 0.9 };
}

function renderHBar_(canvasId, pairs, color, key, unitSuffix, emptyText = 'Sin datos para mostrar.') {
  const hasData = Array.isArray(pairs) && pairs.some(p => Number(p.value) > 0);
  if (!hasData) {
    showCanvasEmpty_(canvasId, emptyText);
    destroyChart_(key);
    return;
  }
  clearCanvasEmpty_(canvasId);
  if (typeof Chart === 'undefined') return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext('2d');
  destroyChart_(key);

  const labels = (pairs || []).map(p => p.name);
  const data = (pairs || []).map(p => Number(p.value) || 0);
  charts[key] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: hexToRgba_(color, 0.25), borderColor: color, borderWidth: 1 }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => unitSuffix ? `${ctx.parsed.x} ${unitSuffix}` : String(ctx.parsed.x) } }
      },
      scales: {
        x: { ticks: { color: 'rgba(0,29,58,0.60)' }, grid: { color: 'rgba(0,29,58,0.10)' } },
        y: { ticks: { color: 'rgba(0,29,58,0.70)' }, grid: { display: false } },
      }
    }
  });
}

function renderPie_(canvasId, data, labels, colors, key, emptyText = 'Sin datos para mostrar.') {
  const hasData = Array.isArray(data) && data.some(v => Number(v) > 0);
  if (!hasData) {
    showCanvasEmpty_(canvasId, emptyText);
    destroyChart_(key);
    return;
  }
  clearCanvasEmpty_(canvasId);
  if (typeof Chart === 'undefined') return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext('2d');
  destroyChart_(key);
  charts[key] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: 'rgba(0,29,58,0.76)' } } } }
  });
}

function showCanvasEmpty_(canvasId, message) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const box = canvas.parentElement;
  if (!box) return;
  box.classList.add('chart-box-empty');
  let empty = box.querySelector('.chart-empty');
  if (!empty) {
    empty = document.createElement('div');
    empty.className = 'chart-empty';
    box.appendChild(empty);
  }
  empty.textContent = message;
  canvas.style.display = 'none';
}

function clearCanvasEmpty_(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const box = canvas.parentElement;
  if (!box) return;
  box.classList.remove('chart-box-empty');
  const empty = box.querySelector('.chart-empty');
  if (empty) empty.remove();
  canvas.style.display = '';
}

function hasMeaningfulSeries_(series) {
  return (series || []).some(arr => Array.isArray(arr) && arr.some(v => Number(v) > 0));
}

function destroyChart_(key) {
  if (charts[key]) { charts[key].destroy(); charts[key] = null; }
}

function setNum_(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = formatNumber_(v);
}

function formatNumber_(n) { try { return Number(n || 0).toLocaleString('es-EC'); } catch (_) { return String(n || 0); } }
function fmtMaybe_(n) { if (n === null || n === undefined || Number(n) === 0) return '—'; return formatNumber_(n); }
function esc_(s) { return String(s || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])); }

function hexToRgba_(hex, a) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return `rgba(0,0,0,${a || 0.1})`;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a || 0.1})`;
}

function iconFor_(t) {
  switch (t) {
    case 'REQUEST_EQUIPMENT': return 'E';
    case 'USE_EQUIPMENT': return 'U';
    case 'REQUEST_REAGENT': return 'R';
    case 'USE_REAGENT': return 'r';
    case 'REQUEST_SUPPLY': return 'I';
    case 'LAB_USAGE': return 'L';
    default: return '•';
  }
}

function labelFor_(t) {
  switch (t) {
    case 'REQUEST_EQUIPMENT': return 'Solicitud de equipo';
    case 'USE_EQUIPMENT': return 'Uso de equipo';
    case 'REQUEST_REAGENT': return 'Solicitud de reactivo';
    case 'USE_REAGENT': return 'Uso de reactivo';
    case 'REQUEST_SUPPLY': return 'Solicitud de insumo';
    case 'LAB_USAGE': return 'Uso de laboratorio';
    default: return t || 'Evento';
  }
}

function niceStatus_(s) {
  const v = String(s || '').toUpperCase();
  if (v === 'ACTIVO') return 'En uso';
  if (v === 'PROGRAMADO') return 'Reservado';
  if (v === 'PENDIENTE') return 'Pendiente';
  if (v === 'COMPLETO') return 'Completado';
  if (v === 'REGISTRADO') return 'Registrado';
  if (v === 'SOLICITADO') return 'Solicitado';
  return s || '';
}

function setStatus_(text, kind) {
  if (!statusEl) return;
  statusEl.textContent = String(text || '');
  const colors = { info: 'rgba(255,255,255,0.55)', success: 'rgba(34, 211, 166, 0.22)', error: 'rgba(180, 35, 24, 0.12)' };
  statusEl.style.background = colors[kind] || colors.info;
}

function showError_(message, err) {
  if (!errorEl) return;
  const details = err && err.message ? String(err.message) : String(err || '');
  errorEl.innerHTML = `${esc_(message)}<div style="margin-top:8px;opacity:.9"><code>${esc_(details)}</code></div><div style="margin-top:8px;opacity:.85">WEB_APP_URL: <code>${esc_(getWebAppUrl())}</code></div>`;
  errorEl.classList.remove('hidden');
}

function clearError_() {
  if (!errorEl) return;
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
}

function ensureAdmin_() {
  try { if (sessionStorage.getItem('adminOk') === '1') return true; } catch (_) {}
  if (document.getElementById('adminAuthOverlay')) return false;

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.className = 'admin-auth';
  overlay.id = 'adminAuthOverlay';
  overlay.innerHTML = `
    <div class="box" role="dialog" aria-modal="true" aria-label="Acceso administrador">
      <h2>Acceso administrador</h2>
      <p>Ingresa el código para ver el dashboard.</p>
      <div class="field">
        <label for="adminPass">Código</label>
        <input id="adminPass" type="password" autocomplete="current-password" placeholder="Código">
      </div>
      <div class="actions">
        <button id="adminEnter" class="btn btn-primary" type="button">Ingresar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const passEl = document.getElementById('adminPass');
  const enterEl = document.getElementById('adminEnter');
  const unlock = () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; };
  const attempt = () => {
    const v = String(passEl && passEl.value || '').trim();
    if (!v) return;
    if (v === ADMIN_PASSCODE) {
      try { sessionStorage.setItem('adminOk', '1'); } catch (_) {}
      overlay.remove();
      unlock();
      return;
    }
    toast('Código incorrecto.', { type: 'error' });
  };

  if (enterEl) enterEl.addEventListener('click', attempt);
  if (passEl) {
    passEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attempt();
      if (e.key === 'Escape') { overlay.remove(); unlock(); }
    });
    passEl.focus();
  }
  return false;
}
