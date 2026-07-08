/* =====================================================================
   NETWORKIFY — config.js
   Global constants shared by every other script. Loaded first.
   No dependencies — safe to reference anywhere after this point.
===================================================================== */

// Registry that page modules (pages/*.js) attach themselves to.
// Declared here because config.js loads BEFORE any page file, and the
// page files run `Pages.<name> = ...` at load time. router.js reads it.
window.Pages = window.Pages || {};
const Pages = window.Pages;

const CONFIG = Object.freeze({
  // -------------------------------------------------------------
  // API
  // -------------------------------------------------------------
  // Same-origin Flask app serves both API and Templates/, so a
  // relative path works in dev and production alike. Override by
  // setting window.__NETWORKIFY_API_URL__ before this script loads
  // (e.g. if the frontend is hosted separately from the API).
  API_BASE_URL: (window.__NETWORKIFY_API_URL__ || '') + '/api',

  // -------------------------------------------------------------
  // Socket.IO
  // -------------------------------------------------------------
  SOCKET_URL:       window.__NETWORKIFY_API_URL__ || '',
  SOCKET_NAMESPACE: '/analysis',
  SOCKET_PATH:      '/socket.io',

  // -------------------------------------------------------------
  // LocalStorage keys
  // -------------------------------------------------------------
  STORAGE_ACCESS_TOKEN:  'networkify_access_token',
  STORAGE_REFRESH_TOKEN: 'networkify_refresh_token',
  STORAGE_USER:          'networkify_user',

  // -------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------
  DEFAULT_PAGE_SIZE: 20,

  // -------------------------------------------------------------
  // Polling fallback (if Socket.IO is unavailable)
  // -------------------------------------------------------------
  JOB_POLL_INTERVAL_MS: 4000,

  // -------------------------------------------------------------
  // Map defaults
  // -------------------------------------------------------------
  MAP_DEFAULT_CENTER: [22.5726, 88.3639], // Kolkata
  MAP_DEFAULT_ZOOM:   12,
  MAP_TILE_URL:       'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  MAP_TILE_ATTRIBUTION:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',

  // -------------------------------------------------------------
  // Enum -> label / colour maps
  // -------------------------------------------------------------
  ANALYSIS_TYPE_LABELS: {
    load_flow:          'Load Flow',
    short_circuit:      'Short Circuit',
    contingency:        'Contingency (N-1)',
    optimal_power_flow: 'Optimal Power Flow',
    time_series:        'Time Series',
    feasibility:        'Feasibility Study',
  },

  ANALYSIS_STATUS_BADGE: {
    pending:   'nw-badge-slate',
    running:   'nw-badge-blue',
    completed: 'nw-badge-green',
    failed:    'nw-badge-red',
    cancelled: 'nw-badge-slate',
  },

  SEVERITY_BADGE: {
    info:     'nw-badge-blue',
    warning:  'nw-badge-amber',
    critical: 'nw-badge-red',
  },

  FEASIBILITY_VERDICT_LABELS: {
    feasible:              'Feasible',
    feasible_with_upgrade: 'Feasible (Upgrade Needed)',
    not_feasible:          'Not Feasible',
    insufficient_data:     'Insufficient Data',
  },

  FEASIBILITY_VERDICT_BADGE: {
    feasible:              'nw-badge-green',
    feasible_with_upgrade: 'nw-badge-amber',
    not_feasible:          'nw-badge-red',
    insufficient_data:     'nw-badge-slate',
  },

  FEASIBILITY_VERDICT_MARKER: {
    feasible:              'nw-marker-feasible',
    feasible_with_upgrade: 'nw-marker-substation',
    not_feasible:          'nw-marker-not-feasible',
    insufficient_data:     'nw-marker-substation',
  },

  FACILITY_TYPE_LABELS: {
    factory:     'Factory',
    data_centre: 'Data Centre',
    warehouse:   'Warehouse',
    office:      'Office',
    other:       'Other',
  },

  FACILITY_SIZE_LABELS: {
    small:  'Small (≤1 MVA)',
    medium: 'Medium (1-10 MVA)',
    large:  'Large (10-50 MVA)',
    xlarge: 'X-Large (>50 MVA)',
  },

  USER_ROLE_LABELS: {
    admin:    'Administrator',
    engineer: 'Engineer',
    user:     'User',
    viewer:   'Viewer',
  },

  REPORT_FORMAT_ICONS: {
    pdf:  'file-text',
    xlsx: 'file-spreadsheet',
  },
});
