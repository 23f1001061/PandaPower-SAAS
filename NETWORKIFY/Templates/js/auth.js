/* =====================================================================
   NETWORKIFY — auth.js
   Session state management: current user, login/register/logout,
   role helpers, and the global 'unauthorized' listener that forces
   re-login when a token can't be refreshed.

   Depends on: config.js, api.js
   Used by:    router.js, app.js, every page module
===================================================================== */

const Auth = (() => {

  let _currentUser = null;

  // -----------------------------------------------------------------
  // Bootstrapping
  // -----------------------------------------------------------------
  /**
   * Restore session from localStorage on page load. Returns the user
   * object if a valid token exists and /auth/me succeeds, else null.
   * Does NOT redirect — callers (app.js) decide what to do.
   */
  async function init() {
    const cached = localStorage.getItem(CONFIG.STORAGE_USER);
    if (cached) {
      try { _currentUser = JSON.parse(cached); } catch { _currentUser = null; }
    }

    const token = API.getAccessToken();
    if (!token) {
      _currentUser = null;
      return null;
    }

    try {
      const res = await API.auth.me();
      _currentUser = res.data.user;
      _persistUser();
      return _currentUser;
    } catch (err) {
      // Token invalid/expired and refresh failed inside API layer
      _currentUser = null;
      API.clearTokens();
      return null;
    }
  }

  function _persistUser() {
    if (_currentUser) {
      localStorage.setItem(CONFIG.STORAGE_USER, JSON.stringify(_currentUser));
    } else {
      localStorage.removeItem(CONFIG.STORAGE_USER);
    }
  }

  // -----------------------------------------------------------------
  // Login / Register / Logout
  // -----------------------------------------------------------------
  async function login({ email, password }) {
    const res = await API.auth.login({ email, password });
    const { user, access_token, refresh_token } = res.data;
    API.setTokens({ access_token, refresh_token });
    _currentUser = user;
    _persistUser();
    window.dispatchEvent(new CustomEvent('networkify:login', { detail: user }));
    return user;
  }

  async function register(payload) {
    const res = await API.auth.register(payload);
    const { user, access_token, refresh_token } = res.data;
    API.setTokens({ access_token, refresh_token });
    _currentUser = user;
    _persistUser();
    window.dispatchEvent(new CustomEvent('networkify:login', { detail: user }));
    return user;
  }

  async function logout({ silent = false } = {}) {
    if (!silent) {
      try { await API.auth.logout(); } catch { /* best-effort */ }
    }
    API.clearTokens();
    _currentUser = null;
    window.dispatchEvent(new CustomEvent('networkify:logout'));
  }

  async function refreshCurrentUser() {
    if (!API.getAccessToken()) return null;
    try {
      const res = await API.auth.me();
      _currentUser = res.data.user;
      _persistUser();
      return _currentUser;
    } catch {
      return _currentUser;
    }
  }

  async function updateProfile(payload) {
    const res = await API.auth.updateMe(payload);
    _currentUser = res.data.user;
    _persistUser();
    return _currentUser;
  }

  // -----------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------
  function currentUser() {
    return _currentUser;
  }

  function isAuthenticated() {
    return !!_currentUser && !!API.getAccessToken();
  }

  function isAdmin() {
    return _currentUser?.role === 'admin';
  }

  function isEngineer() {
    return _currentUser?.role === 'admin' || _currentUser?.role === 'engineer';
  }

  function role() {
    return _currentUser?.role || null;
  }

  function displayName() {
    if (!_currentUser) return '';
    return _currentUser.full_name || _currentUser.username || _currentUser.email;
  }

  function initials() {
    const name = displayName();
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // -----------------------------------------------------------------
  // Global unauthorized handler
  // Fired by api.js when a 401 can't be resolved via refresh.
  // -----------------------------------------------------------------
  window.addEventListener('networkify:unauthorized', () => {
    _currentUser = null;
    _persistUser();
    window.dispatchEvent(new CustomEvent('networkify:logout'));
    if (typeof Toast !== 'undefined') {
      Toast.show('Session expired. Please sign in again.', 'warning');
    }
    if (typeof Router !== 'undefined') {
      Router.navigate('/login');
    } else {
      window.location.hash = '#/login';
    }
  });

  return {
    init,
    login,
    register,
    logout,
    refreshCurrentUser,
    updateProfile,
    currentUser,
    isAuthenticated,
    isAdmin,
    isEngineer,
    role,
    displayName,
    initials,
  };
})();
