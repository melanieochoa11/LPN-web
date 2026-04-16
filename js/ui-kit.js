/*
  Small UI helpers shared by the frontend pages.
  Keep this file framework-free and ASCII-only.
*/

const TOAST_STACK_ID = 'toastStack';

function ensureToastStack() {
  let stack = document.getElementById(TOAST_STACK_ID);
  if (stack) return stack;
  stack = document.createElement('div');
  stack.id = TOAST_STACK_ID;
  stack.className = 'toast-stack';
  document.body.appendChild(stack);
  return stack;
}

export function toast(message, opts = {}) {
  const {
    type = 'info',
    timeout = 3400,
  } = opts;

  const stack = ensureToastStack();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = String(message || '');
  stack.appendChild(el);

  window.setTimeout(() => {
    el.remove();
    if (stack.childElementCount === 0) stack.remove();
  }, Math.max(800, timeout));
}

export function setButtonLoading(btn, loading, loadingText = 'Enviando...') {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
    btn.setAttribute('aria-disabled', 'true');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${escapeHtml_(loadingText)}`;
    return;
  }
  const original = btn.dataset.originalText || btn.textContent;
  btn.disabled = false;
  btn.removeAttribute('aria-disabled');
  btn.textContent = original;
}

export function setFieldError(inputEl, message) {
  if (!inputEl) return;
  inputEl.setAttribute('aria-invalid', 'true');

  const existingId = inputEl.getAttribute('aria-describedby');
  let errorEl = existingId ? document.getElementById(existingId) : null;

  if (!errorEl || !errorEl.classList.contains('field-error')) {
    errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    errorEl.id = `err_${Math.random().toString(36).slice(2)}`;
    inputEl.insertAdjacentElement('afterend', errorEl);
    inputEl.setAttribute('aria-describedby', errorEl.id);
  }
  errorEl.textContent = String(message || 'Campo requerido.');
}

export function clearFieldError(inputEl) {
  if (!inputEl) return;
  inputEl.removeAttribute('aria-invalid');
  const describedBy = inputEl.getAttribute('aria-describedby');
  if (!describedBy) return;
  const errorEl = document.getElementById(describedBy);
  if (errorEl && errorEl.classList.contains('field-error')) {
    errorEl.remove();
    inputEl.removeAttribute('aria-describedby');
  }
}

export function validateRequired(inputs) {
  let ok = true;
  (inputs || []).forEach(el => {
    if (!el) return;
    clearFieldError(el);
    const isRequired = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
    if (!isRequired) return;
    if (!String(el.value || '').trim()) {
      setFieldError(el, 'Este campo es obligatorio.');
      ok = false;
    }
  });
  return ok;
}

export function slugify(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function setCatalogImage(imgEl, opts) {
  if (!imgEl) return;
  const {
    basePath,
    slug,
    exts = ['png', 'jpg', 'jpeg'],
    placeholder = 'placeholder_light_gray_block.png',
  } = opts || {};

  const cleanBase = String(basePath || '').replace(/\/+$/, '');
  const s = String(slug || '');
  const sources = exts.map(ext => `${cleanBase}/${s}.${ext}`);
  sources.push(placeholder);

  let idx = 0;
  imgEl.onerror = () => {
    idx += 1;
    if (idx < sources.length) imgEl.src = sources[idx];
  };
  imgEl.src = sources[0];
}

function escapeHtml_(s) {
  return String(s || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}
