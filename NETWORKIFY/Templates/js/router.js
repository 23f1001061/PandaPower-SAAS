/* =====================================================================
   NETWORKIFY — router.js
   Hash-based SPA router. Maps #/path -> a page module's render fn.

   Page modules register themselves on the global `Pages` object, e.g.
       Pages.dashboard = { render(container, params) {...}, cleanup() {} }

   Routes support a single :param segment, e.g. #/networks/:id

   Depends on: utils.js, auth.js, components.js
===================================================================== */

const Router = (() => {

  let _currentCleanup = null;

  // route pattern -> { page, requiresAuth, adminOnly, title }
  const ROUTES = [
    { pattern: '/login',                 page: 'login',            auth: false, title: 'Sign In' },
    { pattern: '/register',              page: 'register',         auth: false, title: 'Register' },
    { pattern: '/dashboard',             page: 'dashboard',        auth: true,  title: 'Dashboard' },
    { pattern: '/networks',              page: 'networks',         auth: true,  title: 'Networks' },
    { pattern: '/networks/:id',          page: 'network-detail',   auth: true,  title: 'Network' },
    { pattern: '/substations',           page: 'substations',      auth: true,  title: 'Substations' },
    { pattern: '/facilities',            page: 'facilities',       auth: true,  title: 'Facilities' },
    { pattern: '/facilities/:id',        page: 'facility-detail',  auth: true,  title: 'Facility' },
    { pattern: '/facilities/:id/studies/:studyId', page: 'feasibility-result', auth: true, title: 'Feasibility' },
    { pattern: '/analyses',              page: 'analyses',         auth: true,  title: 'Analysis Jobs' },
    { pattern: '/analyses/:id',          page: 'analysis-result',  auth: true,  title: 'Analysis Result' },
    { pattern: '/reports',               page: 'reports',          auth: true,  title: 'Reports' },
    { pattern: '/profile',               page: 'profile',          auth: true,  title: 'Profile' },
    { pattern: '/admin',                 page: 'admin',            auth: true,  adminOnly: true, title: 'Admin' },
  ];

  function _match(path) {
    for (const route of ROUTES) {
      const pp = route.pattern.split('/').filter(Boolean);
      const cp = path.split('/').filter(Boolean);
      if (pp.length !== cp.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < pp.length; i++) {
        if (pp[i].startsWith(':')) {
          params[pp[i].slice(1)] = decodeURIComponent(cp[i]);
        } else if (pp[i] !== cp[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { route, params };
    }
    return null;
  }

  async function _render() {
    let hash = window.location.hash.replace(/^#/, '') || '/dashboard';
    if (!hash.startsWith('/')) hash = '/' + hash;

    const matched = _match(hash);

    // Unknown route
    if (!matched) {
      _navigate(Auth.isAuthenticated() ? '/dashboard' : '/login');
      return;
    }

    const { route, params } = matched;

    // Auth gate
    if (route.auth && !Auth.isAuthenticated()) {
      _navigate('/login');
      return;
    }
    if (!route.auth && Auth.isAuthenticated() && (route.page === 'login' || route.page === 'register')) {
      _navigate('/dashboard');
      return;
    }
    if (route.adminOnly && !Auth.isAdmin()) {
      Toast.error('Administrator access required');
      _navigate('/dashboard');
      return;
    }

    // Toggle shells
    _setShell(route.auth);

    // Run previous page cleanup
    if (typeof _currentCleanup === 'function') {
      try { _currentCleanup(); } catch (e) { /* ignore */ }
      _currentCleanup = null;
    }

    const mod = Pages[route.page];
    const container = route.auth
      ? document.getElementById('page-content')
      : document.getElementById('auth-page');

    if (!mod || typeof mod.render !== 'function') {
      container.innerHTML = Components.empty({
        icon: 'alert-triangle',
        message: `Page "${route.page}" failed to load.`,
      });
      Utils.icons();
      return;
    }

    // Update breadcrumb + active nav
    _setBreadcrumb(route.title);
    _setActiveNav(route.page, params);

    try {
      await mod.render(container, params);
      _currentCleanup = typeof mod.cleanup === 'function' ? () => mod.cleanup() : null;
    } catch (err) {
      console.error('[Router] render error:', err);
      container.innerHTML = Components.empty({
        icon: 'alert-circle',
        message: err.message || 'Something went wrong rendering this page.',
      });
      Utils.icons();
    }
    Utils.icons();
  }

  function _setShell(isAppPage) {
    const authShell = document.getElementById('auth-shell');
    const appShell  = document.getElementById('app-shell');
    if (isAppPage) {
      authShell?.classList.add('hidden');
      appShell?.classList.remove('hidden');
    } else {
      appShell?.classList.add('hidden');
      authShell?.classList.remove('hidden');
      authShell?.classList.add('flex');
    }
  }

  function _setBreadcrumb(title) {
    const b = document.getElementById('breadcrumb-page');
    if (b) b.textContent = title;
  }

  function _setActiveNav(page, params) {
    // Map detail pages back to their section for nav highlight
    const sectionMap = {
      'network-detail':     'networks',
      'analysis-result':    'analyses',
      'facility-detail':    'facilities',
      'feasibility-result': 'facilities',
    };
    const active = sectionMap[page] || page;
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.page === active);
    });
  }

  function _navigate(path) {
    if (window.location.hash === '#' + path) {
      _render(); // force re-render if same hash
    } else {
      window.location.hash = '#' + path;
    }
  }

  function init() {
    window.addEventListener('hashchange', _render);
  }

  return {
    init,
    navigate: _navigate,
    render: _render,
  };
})();
