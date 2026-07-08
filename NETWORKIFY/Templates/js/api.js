/* =====================================================================
   NETWORKIFY — api.js
   Thin fetch() wrapper + one function per backend endpoint.
   Every response from the backend follows:
     { success: bool, message: str, data?: any, pagination?: {...} }

   On 401, this module attempts a silent token refresh once via
   /api/auth/refresh, then retries the original request. If that
   also fails, it dispatches a 'networkify:unauthorized' event that
   auth.js listens for to force a logout + redirect to /#/login.
===================================================================== */

const API = (() => {

  let _isRefreshing = false;
  let _refreshQueue = [];

  // -----------------------------------------------------------------
  // Token helpers
  // -----------------------------------------------------------------
  function getAccessToken() {
    return localStorage.getItem(CONFIG.STORAGE_ACCESS_TOKEN);
  }
  function getRefreshToken() {
    return localStorage.getItem(CONFIG.STORAGE_REFRESH_TOKEN);
  }
  function setTokens({ access_token, refresh_token } = {}) {
    if (access_token)  localStorage.setItem(CONFIG.STORAGE_ACCESS_TOKEN,  access_token);
    if (refresh_token) localStorage.setItem(CONFIG.STORAGE_REFRESH_TOKEN, refresh_token);
  }
  function clearTokens() {
    localStorage.removeItem(CONFIG.STORAGE_ACCESS_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_REFRESH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_USER);
  }

  // -----------------------------------------------------------------
  // Core request function
  // -----------------------------------------------------------------
  /**
   * @param {string} path     - path relative to API_BASE_URL, e.g. '/networks/'
   * @param {object} options  - fetch options (method, body, headers, ...)
   * @param {object} opts2    - { auth: bool (default true), raw: bool, isRetry: bool }
   * @returns {Promise<any>}  - parsed JSON body (the full envelope)
   */
  async function request(path, options = {}, opts2 = {}) {
    const { auth = true, raw = false, isRetry = false } = opts2;

    const headers = new Headers(options.headers || {});
    const isFormData = options.body instanceof FormData;
    if (!isFormData && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (auth) {
      const token = getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    let response;
    try {
      response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
        ...options,
        headers,
      });
    } catch (networkErr) {
      throw new ApiError(
        'Network error — is the API reachable?',
        0,
        { networkError: true },
      );
    }

    // Raw mode: return the Response object itself (file downloads etc.)
    if (raw) return response;

    let body = null;
    const text = await response.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { success: response.ok, message: text };
      }
    }

    // ---- 401 handling: try refresh once, then retry --------------
    if (response.status === 401 && auth && !isRetry) {
      const refreshed = await _tryRefresh();
      if (refreshed) {
        return request(path, options, { ...opts2, isRetry: true });
      }
      clearTokens();
      window.dispatchEvent(new CustomEvent('networkify:unauthorized'));
      throw new ApiError(body?.message || 'Unauthorized', 401, body);
    }

    if (!response.ok || body?.success === false) {
      throw new ApiError(
        body?.message || `Request failed (${response.status})`,
        response.status,
        body,
      );
    }

    return body;
  }

  async function _tryRefresh() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    // Coalesce concurrent refresh attempts
    if (_isRefreshing) {
      return new Promise((resolve) => _refreshQueue.push(resolve));
    }
    _isRefreshing = true;
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshToken}` },
      });
      if (!res.ok) {
        _refreshQueue.forEach((r) => r(false));
        _refreshQueue = [];
        return false;
      }
      const body = await res.json();
      if (body?.data?.access_token) {
        setTokens({ access_token: body.data.access_token });
        _refreshQueue.forEach((r) => r(true));
        _refreshQueue = [];
        return true;
      }
      _refreshQueue.forEach((r) => r(false));
      _refreshQueue = [];
      return false;
    } catch {
      _refreshQueue.forEach((r) => r(false));
      _refreshQueue = [];
      return false;
    } finally {
      _isRefreshing = false;
    }
  }

  // -----------------------------------------------------------------
  // Verb shorthands
  // -----------------------------------------------------------------
  const get    = (path, opts)        => request(path, { method: 'GET' }, opts);
  const del    = (path, opts)        => request(path, { method: 'DELETE' }, opts);
  const post   = (path, body, opts)  => request(path, { method: 'POST',  body: _serialize(body) }, opts);
  const patch  = (path, body, opts)  => request(path, { method: 'PATCH', body: _serialize(body) }, opts);
  const put    = (path, body, opts)  => request(path, { method: 'PUT',   body: _serialize(body) }, opts);

  function _serialize(body) {
    if (body === undefined || body === null) return undefined;
    if (body instanceof FormData) return body;
    return JSON.stringify(body);
  }

  /** Build a query string from a params object, skipping null/undefined/empty. */
  function qs(params = {}) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') return;
      if (Array.isArray(v)) {
        v.forEach((item) => usp.append(k, item));
      } else {
        usp.append(k, v);
      }
    });
    const s = usp.toString();
    return s ? `?${s}` : '';
  }

  // ===================================================================
  //  AUTH
  // ===================================================================
  const auth = {
    register: (payload) => post('/auth/register', payload, { auth: false }),
    login:    (payload) => post('/auth/login',    payload, { auth: false }),
    logout:   ()         => post('/auth/logout', null),
    me:       ()         => get('/auth/me'),
    updateMe: (payload)  => patch('/auth/me', payload),
    changePassword: (payload) => post('/auth/change-password', payload),
    forgotPassword: (payload) => post('/auth/forgot-password', payload, { auth: false }),
    resetPassword:  (payload) => post('/auth/reset-password',  payload, { auth: false }),
  };

  // ===================================================================
  //  USERS
  // ===================================================================
  const users = {
    list:       (params)        => get(`/users/${qs(params)}`),
    get:        (id)             => get(`/users/${id}`),
    update:     (id, payload)    => patch(`/users/${id}`, payload),
    deactivate: (id)             => del(`/users/${id}`),
    activate:   (id)             => post(`/users/${id}/activate`, null),
  };

  // ===================================================================
  //  NETWORKS
  // ===================================================================
  const networks = {
    list:    (params)        => get(`/networks/${qs(params)}`),
    create:  (payload)       => post('/networks/', payload),
    get:     (id)             => get(`/networks/${id}`),
    update:  (id, payload)    => patch(`/networks/${id}`, payload),
    remove:  (id)             => del(`/networks/${id}`),
    clone:   (id, payload)    => post(`/networks/${id}/clone`, payload),
    importJson: (id, payload) => post(`/networks/${id}/import`, payload),
    exportJson: (id)          => get(`/networks/${id}/export`),
    fromTemplate: (id, template) => post(`/networks/${id}/from-template`, { template }),
    share:   (id)             => post(`/networks/${id}/share`, null),

    // ---- Elements (generic, used for all 8 element types) ----------
    listElements:  (netId, kind)            => get(`/networks/${netId}/${kind}`),
    createElement: (netId, kind, payload)   => post(`/networks/${netId}/${kind}`, payload),
    updateElement: (netId, kind, id, payload) => patch(`/networks/${netId}/${kind}/${id}`, payload),
    deleteElement: (netId, kind, id)        => del(`/networks/${netId}/${kind}/${id}`),
  };

  // Element kind constants (path segments used with the generic helpers)
  const ELEMENT_KINDS = Object.freeze({
    BUSES:        'buses',
    LINES:        'lines',
    TRANSFORMERS: 'transformers',
    LOADS:        'loads',
    GENERATORS:   'generators',
    EXT_GRIDS:    'ext-grids',
    SWITCHES:     'switches',
    SHUNTS:       'shunts',
  });

  // ===================================================================
  //  SUBSTATIONS
  // ===================================================================
  const substations = {
    list:     (params)        => get(`/substations/${qs(params)}`),
    create:   (payload)       => post('/substations/', payload),
    get:      (id)             => get(`/substations/${id}`),
    update:   (id, payload)    => patch(`/substations/${id}`, payload),
    remove:   (id)             => del(`/substations/${id}`),
    nearby:   (params)         => get(`/substations/nearby${qs(params)}`),
    bulkUpload: (formData)     => post('/substations/bulk-upload', formData),
    importOsm:  (payload)      => post('/substations/import-osm', payload),

    listFeeders:  (subId)              => get(`/substations/${subId}/feeders`),
    addFeeder:    (subId, payload)     => post(`/substations/${subId}/feeders`, payload),
    updateFeeder: (subId, fId, payload)=> patch(`/substations/${subId}/feeders/${fId}`, payload),
    removeFeeder: (subId, fId)         => del(`/substations/${subId}/feeders/${fId}`),

    listTransmissionLines:  (params)   => get(`/substations/transmission-lines${qs(params)}`),
    createTransmissionLine: (payload)  => post('/substations/transmission-lines', payload),
  };

  // ===================================================================
  //  FACILITIES
  // ===================================================================
  const facilities = {
    list:    (params)        => get(`/facilities/${qs(params)}`),
    create:  (payload)       => post('/facilities/', payload),
    get:     (id)             => get(`/facilities/${id}`),
    update:  (id, payload)    => patch(`/facilities/${id}`, payload),
    remove:  (id)             => del(`/facilities/${id}`),

    nearbySubstations: (id, params) => get(`/facilities/${id}/nearby-substations${qs(params)}`),
    runFeasibility:    (id, payload) => post(`/facilities/${id}/feasibility`, payload || {}),
    listStudies:       (id)          => get(`/facilities/${id}/studies`),
    getStudy:          (id, studyId) => get(`/facilities/${id}/studies/${studyId}`),
  };

  // ===================================================================
  //  ANALYSES
  // ===================================================================
  const analyses = {
    list:   (params)         => get(`/analyses/${qs(params)}`),
    get:    (id, params)      => get(`/analyses/${id}${qs(params)}`),
    remove: (id)               => del(`/analyses/${id}`),
    cancel: (id)               => post(`/analyses/${id}/cancel`, null),

    runLoadFlow:     (payload) => post('/analyses/load-flow',     payload),
    runShortCircuit: (payload) => post('/analyses/short-circuit', payload),
    runContingency:  (payload) => post('/analyses/contingency',   payload),
    runOpf:          (payload) => post('/analyses/opf',           payload),
    runTimeSeries:   (payload) => post('/analyses/time-series',   payload),

    violations:          (id, params) => get(`/analyses/${id}/violations${qs(params)}`),
    faultResults:        (id)          => get(`/analyses/${id}/fault-results`),
    contingencyResults:  (id, params)  => get(`/analyses/${id}/contingency-results${qs(params)}`),
    timeseriesResults:   (id, params)  => get(`/analyses/${id}/timeseries-results${qs(params)}`),
  };

  // ===================================================================
  //  REPORTS
  // ===================================================================
  const reports = {
    list:   (params)   => get(`/reports/${qs(params)}`),
    create: (payload)  => post('/reports/', payload),
    get:    (id)        => get(`/reports/${id}`),
    remove: (id)        => del(`/reports/${id}`),

    /** Returns a Blob ready for an <a download> link via URL.createObjectURL */
    download: async (id) => {
      const res = await request(`/reports/${id}/download`, { method: 'GET' }, { raw: true });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(body?.message || 'Download failed', res.status, body);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      return { blob, filename: match ? match[1] : `report_${id}` };
    },
  };

  // ===================================================================
  //  ADMIN
  // ===================================================================
  const admin = {
    stats:          ()        => get('/admin/stats'),
    auditLogs:      (params)  => get(`/admin/audit-logs${qs(params)}`),
    recentUsers:    (params)  => get(`/admin/users/recent${qs(params)}`),
    activeJobs:     ()        => get('/admin/jobs/active'),

    listPlans:      ()             => get('/admin/plans'),
    createPlan:     (payload)      => post('/admin/plans', payload),
    updatePlan:     (id, payload)  => patch(`/admin/plans/${id}`, payload),
    deactivatePlan: (id)           => del(`/admin/plans/${id}`),
  };

  // ===================================================================
  //  HEALTH
  // ===================================================================
  const health = () => get('/health', { auth: false });

  return {
    request, get, post, patch, put, del, qs,
    getAccessToken, getRefreshToken, setTokens, clearTokens,
    ELEMENT_KINDS,
    auth, users, networks, substations, facilities,
    analyses, reports, admin, health,
  };
})();


/* =====================================================================
   ApiError — thrown by API.request on any non-2xx / success:false
===================================================================== */
class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body || {};
  }

  /** Marshmallow-style field errors, if present: { field: [msgs] } */
  get fieldErrors() {
    return this.body?.errors || {};
  }

  get isNetworkError() {
    return this.status === 0;
  }
}
