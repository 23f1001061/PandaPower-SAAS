/* =====================================================================
   NETWORKIFY — components.js
   Reusable HTML fragment builders + the global Modal controller.
   Returns HTML strings (caller injects); keeps pages declarative.

   Depends on: utils.js
===================================================================== */

const Components = (() => {

  // -----------------------------------------------------------------
  // Page header
  // -----------------------------------------------------------------
  function pageHeader({ title, subtitle, actions = '' }) {
    return `
      <div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 class="font-display text-3xl tracking-wide text-ink-100">${Utils.esc(title)}</h1>
          ${subtitle ? `<p class="text-ink-500 text-sm mt-1">${Utils.esc(subtitle)}</p>` : ''}
        </div>
        <div class="flex items-center gap-2">${actions}</div>
      </div>
    `;
  }

  // -----------------------------------------------------------------
  // Stat card
  // -----------------------------------------------------------------
  function statCard({ label, value, icon, sub = '', accent = 'brand' }) {
    const accentColor = accent === 'green' ? 'text-green-400'
                      : accent === 'red'   ? 'text-red-400'
                      : accent === 'blue'  ? 'text-blue-400'
                      : 'text-brand-400';
    return `
      <div class="nw-stat-card">
        <div class="flex items-start justify-between">
          <div>
            <p class="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-500 mb-2">${Utils.esc(label)}</p>
            <p class="font-display text-3xl ${accentColor} leading-none">${value}</p>
            ${sub ? `<p class="text-ink-500 text-xs mt-2">${sub}</p>` : ''}
          </div>
          ${icon ? `<div class="w-9 h-9 rounded-lg bg-ink-800/60 border border-ink-700/60 flex items-center justify-center ${accentColor}">
            <i data-lucide="${icon}" class="w-4 h-4"></i>
          </div>` : ''}
        </div>
      </div>
    `;
  }

  // -----------------------------------------------------------------
  // Card wrapper
  // -----------------------------------------------------------------
  function card({ header = '', body = '', extraClass = '' }) {
    return `
      <div class="nw-card ${extraClass}">
        ${header ? `<div class="nw-card-header">${header}</div>` : ''}
        ${body}
      </div>
    `;
  }

  // -----------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------
  function empty({ icon = 'inbox', message = 'Nothing here yet.', action = '' }) {
    return `
      <div class="nw-empty">
        <i data-lucide="${icon}" class="w-12 h-12"></i>
        <p>${Utils.esc(message)}</p>
        ${action}
      </div>
    `;
  }

  // -----------------------------------------------------------------
  // Spinner / loading block
  // -----------------------------------------------------------------
  function loading(label = 'Loading...') {
    return `
      <div class="flex flex-col items-center justify-center py-16 gap-3">
        <span class="nw-spinner"></span>
        <p class="font-mono text-xs text-ink-500 tracking-wider">${Utils.esc(label)}</p>
      </div>
    `;
  }

  // -----------------------------------------------------------------
  // Buttons
  // -----------------------------------------------------------------
  function primaryBtn({ id = '', label, icon = '', type = 'button' }) {
    return `<button ${id ? `id="${id}"` : ''} type="${type}" class="nw-btn-primary" style="width:auto">
      ${icon ? `<i data-lucide="${icon}" class="w-4 h-4"></i>` : ''}${Utils.esc(label)}
    </button>`;
  }
  function secondaryBtn({ id = '', label, icon = '', href = '' }) {
    if (href) {
      return `<a ${id ? `id="${id}"` : ''} href="${href}" class="nw-btn-secondary">
        ${icon ? `<i data-lucide="${icon}" class="w-3.5 h-3.5"></i>` : ''}${Utils.esc(label)}
      </a>`;
    }
    return `<button ${id ? `id="${id}"` : ''} type="button" class="nw-btn-secondary">
      ${icon ? `<i data-lucide="${icon}" class="w-3.5 h-3.5"></i>` : ''}${Utils.esc(label)}
    </button>`;
  }

  // -----------------------------------------------------------------
  // Form field
  // -----------------------------------------------------------------
  function field({ label, name, type = 'text', value = '', placeholder = '',
                   required = false, step = '', min = '', max = '', hint = '' }) {
    return `
      <div>
        <label class="nw-label" for="f-${name}">${Utils.esc(label)}${required ? ' *' : ''}</label>
        <input class="nw-input" id="f-${name}" name="${name}" type="${type}"
               value="${Utils.esc(value)}" placeholder="${Utils.esc(placeholder)}"
               ${required ? 'required' : ''} ${step ? `step="${step}"` : ''}
               ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''} />
        ${hint ? `<p class="text-ink-600 text-xs mt-1">${Utils.esc(hint)}</p>` : ''}
      </div>
    `;
  }

  function selectField({ label, name, options = [], value = '', required = false, hint = '' }) {
    const opts = options.map((o) => {
      const val = typeof o === 'object' ? o.value : o;
      const lbl = typeof o === 'object' ? o.label : o;
      return `<option value="${Utils.esc(val)}" ${val === value ? 'selected' : ''}>${Utils.esc(lbl)}</option>`;
    }).join('');
    return `
      <div>
        <label class="nw-label" for="f-${name}">${Utils.esc(label)}${required ? ' *' : ''}</label>
        <select class="nw-input" id="f-${name}" name="${name}" ${required ? 'required' : ''}>${opts}</select>
        ${hint ? `<p class="text-ink-600 text-xs mt-1">${Utils.esc(hint)}</p>` : ''}
      </div>
    `;
  }

  // -----------------------------------------------------------------
  // Table
  // -----------------------------------------------------------------
  function table({ columns = [], rows = [], emptyMessage = 'No data' }) {
    if (!rows.length) {
      return `<div class="text-center py-10 text-ink-600 text-sm">${Utils.esc(emptyMessage)}</div>`;
    }
    const head = columns.map((c) => `<th>${Utils.esc(c)}</th>`).join('');
    const body = rows.map((cells) =>
      `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`
    ).join('');
    return `
      <div class="overflow-x-auto">
        <table class="nw-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  // -----------------------------------------------------------------
  // Progress bar
  // -----------------------------------------------------------------
  function progress(pct, id = '') {
    return `
      <div class="nw-progress" ${id ? `id="${id}"` : ''}>
        <div class="nw-progress-bar" style="width:${Math.max(0, Math.min(100, pct))}%"></div>
      </div>
    `;
  }

  // -----------------------------------------------------------------
  // Pagination footer
  // -----------------------------------------------------------------
  function pagination(meta, onPage) {
    if (!meta || meta.pages <= 1) return '';
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center justify-between mt-4 font-mono text-xs text-ink-500';
    wrap.innerHTML = `
      <span>Page ${meta.page} of ${meta.pages} · ${meta.total} total</span>
      <div class="flex gap-2">
        <button class="nw-btn-secondary" ${meta.page <= 1 ? 'disabled' : ''} data-pg="${meta.page - 1}">Prev</button>
        <button class="nw-btn-secondary" ${meta.page >= meta.pages ? 'disabled' : ''} data-pg="${meta.page + 1}">Next</button>
      </div>
    `;
    wrap.querySelectorAll('button[data-pg]').forEach((b) => {
      b.addEventListener('click', () => {
        if (!b.disabled) onPage(parseInt(b.dataset.pg, 10));
      });
    });
    return wrap;
  }

  return {
    pageHeader, statCard, card, empty, loading,
    primaryBtn, secondaryBtn, field, selectField, table,
    progress, pagination,
  };
})();


/* =====================================================================
   Modal — global dialog controller
===================================================================== */
const Modal = (() => {
  let _onClose = null;

  function open(html, { onClose = null } = {}) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (!overlay || !content) return;
    content.innerHTML = html;
    overlay.classList.remove('hidden');
    _onClose = onClose;
    if (window.lucide) window.lucide.createIcons();

    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.addEventListener('keydown', _escHandler);
  }

  function close() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    document.removeEventListener('keydown', _escHandler);
    if (typeof _onClose === 'function') _onClose();
    _onClose = null;
  }

  function _escHandler(e) {
    if (e.key === 'Escape') close();
  }

  /** Convenience confirm dialog. */
  function confirm({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
    open(`
      <h3 class="font-display text-xl tracking-wide text-ink-100 mb-2">${Utils.esc(title)}</h3>
      <p class="text-ink-400 text-sm mb-6">${Utils.esc(message)}</p>
      <div class="flex justify-end gap-2">
        <button class="nw-btn-secondary" id="modal-cancel">Cancel</button>
        <button class="${danger ? 'nw-btn-danger' : 'nw-btn-primary'}" id="modal-confirm" style="width:auto">
          ${Utils.esc(confirmLabel)}
        </button>
      </div>
    `);
    document.getElementById('modal-cancel').onclick = close;
    document.getElementById('modal-confirm').onclick = async () => {
      await onConfirm();
      close();
    };
  }

  return { open, close, confirm };
})();
