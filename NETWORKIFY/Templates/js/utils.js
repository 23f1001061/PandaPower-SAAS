/* =====================================================================
   NETWORKIFY — utils.js
   Pure helper functions: formatters, badge/label lookups, toast, and
   small DOM utilities. No dependencies beyond config.js.
===================================================================== */

const Utils = (() => {

  // -----------------------------------------------------------------
  // Number / unit formatting
  // -----------------------------------------------------------------
  function num(value, decimals = 2) {
    if (value === null || value === undefined || value === '' || isNaN(value)) return '—';
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function mw(value, d = 2)   { return value == null ? '—' : `${num(value, d)} MW`; }
  function mva(value, d = 2)  { return value == null ? '—' : `${num(value, d)} MVA`; }
  function mvar(value, d = 2) { return value == null ? '—' : `${num(value, d)} MVAr`; }
  function kv(value, d = 1)   { return value == null ? '—' : `${num(value, d)} kV`; }
  function ka(value, d = 3)   { return value == null ? '—' : `${num(value, d)} kA`; }
  function km(value, d = 2)   { return value == null ? '—' : `${num(value, d)} km`; }
  function pu(value, d = 4)   { return value == null ? '—' : `${num(value, d)} p.u.`; }
  function pct(value, d = 1)  { return value == null ? '—' : `${num(value, d)}%`; }
  function deg(value, d = 2)  { return value == null ? '—' : `${num(value, d)}°`; }

  function inrLakh(value) {
    if (value == null || isNaN(value)) return '—';
    return `₹${num(value, 1)} L`;
  }

  function fileSize(bytes) {
    if (bytes == null || isNaN(bytes)) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = Number(bytes), i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${num(v, i === 0 ? 0 : 1)} ${units[i]}`;
  }

  // -----------------------------------------------------------------
  // Date / time
  // -----------------------------------------------------------------
  function date(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function datetime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return '—';
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function relativeTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return '—';
    const secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secs < 60)    return 'just now';
    if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    if (secs < 604800)return `${Math.floor(secs / 86400)}d ago`;
    return date(value);
  }

  function duration(seconds) {
    if (seconds == null || isNaN(seconds)) return '—';
    if (seconds < 1)  return `${Math.round(seconds * 1000)} ms`;
    if (seconds < 60) return `${num(seconds, 2)} s`;
    const m = Math.floor(seconds / 60), s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  // -----------------------------------------------------------------
  // Labels / badges (read from CONFIG maps)
  // -----------------------------------------------------------------
  function analysisTypeLabel(t) { return CONFIG.ANALYSIS_TYPE_LABELS[t] || t || '—'; }
  function statusBadgeClass(s)  { return CONFIG.ANALYSIS_STATUS_BADGE[s] || 'nw-badge-slate'; }
  function severityBadgeClass(s){ return CONFIG.SEVERITY_BADGE[s] || 'nw-badge-slate'; }
  function verdictLabel(v)      { return CONFIG.FEASIBILITY_VERDICT_LABELS[v] || v || '—'; }
  function verdictBadgeClass(v) { return CONFIG.FEASIBILITY_VERDICT_BADGE[v] || 'nw-badge-slate'; }
  function verdictTextClass(v)  { return `verdict-${v}`; }
  function facilityTypeLabel(t) { return CONFIG.FACILITY_TYPE_LABELS[t] || t || '—'; }
  function facilitySizeLabel(s) { return CONFIG.FACILITY_SIZE_LABELS[s] || s || '—'; }
  function roleLabel(r)         { return CONFIG.USER_ROLE_LABELS[r] || r || '—'; }

  function statusBadge(status) {
    return `<span class="nw-badge ${statusBadgeClass(status)}">${(status || '').toUpperCase()}</span>`;
  }
  function severityBadge(sev) {
    return `<span class="nw-badge ${severityBadgeClass(sev)}">${(sev || '').toUpperCase()}</span>`;
  }
  function verdictBadge(verdict) {
    return `<span class="nw-badge ${verdictBadgeClass(verdict)}">${verdictLabel(verdict).toUpperCase()}</span>`;
  }

  // -----------------------------------------------------------------
  // HTML escaping
  // -----------------------------------------------------------------
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -----------------------------------------------------------------
  // DOM helpers
  // -----------------------------------------------------------------
  function el(id) { return document.getElementById(id); }
  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  /** Re-render Lucide icons after injecting HTML with data-lucide attrs. */
  function icons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /** Read a CSS variable from :root. */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // -----------------------------------------------------------------
  // Debounce
  // -----------------------------------------------------------------
  function debounce(fn, ms = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // -----------------------------------------------------------------
  // Misc
  // -----------------------------------------------------------------
  function truncate(str, n = 40) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function colorForVerdict(v) {
    return ({
      feasible:              '#4ade80',
      feasible_with_upgrade: '#fbbf24',
      not_feasible:          '#f87171',
      insufficient_data:     '#94a3b8',
    })[v] || '#94a3b8';
  }

  return {
    num, mw, mva, mvar, kv, ka, km, pu, pct, deg, inrLakh, fileSize,
    date, datetime, relativeTime, duration,
    analysisTypeLabel, statusBadgeClass, severityBadgeClass,
    verdictLabel, verdictBadgeClass, verdictTextClass,
    facilityTypeLabel, facilitySizeLabel, roleLabel,
    statusBadge, severityBadge, verdictBadge,
    esc, el, qs, qsa, icons, cssVar, debounce, truncate,
    downloadBlob, colorForVerdict,
  };
})();


/* =====================================================================
   Toast — global notifications
===================================================================== */
const Toast = (() => {
  const ICONS = {
    success: 'check-circle',
    error:   'alert-circle',
    info:    'info',
    warning: 'alert-triangle',
  };

  function show(message, type = 'info', timeout = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `nw-toast ${type}`;
    toast.innerHTML = `
      <i data-lucide="${ICONS[type] || 'info'}" class="w-4 h-4 flex-shrink-0 mt-0.5"></i>
      <span class="flex-1">${Utils.esc(message)}</span>
      <button class="text-ink-500 hover:text-ink-200 flex-shrink-0">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    `;
    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    const remove = () => {
      toast.style.animation = 'slideOut 0.25s ease forwards';
      setTimeout(() => toast.remove(), 250);
    };
    toast.querySelector('button').addEventListener('click', remove);
    if (timeout > 0) setTimeout(remove, timeout);
  }

  return {
    show,
    success: (m, t) => show(m, 'success', t),
    error:   (m, t) => show(m, 'error', t),
    info:    (m, t) => show(m, 'info', t),
    warning: (m, t) => show(m, 'warning', t),
  };
})();
