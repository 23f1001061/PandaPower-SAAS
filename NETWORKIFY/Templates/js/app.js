/* =====================================================================
   NETWORKIFY — app.js
   Bootstrap: wire global UI chrome, restore session, start router.
   Must load LAST (after all pages + router).

   Depends on: everything else.
===================================================================== */

(function () {

  const loader       = document.getElementById('app-loader');
  const loaderBar    = document.getElementById('loader-bar');
  const loaderStatus = document.getElementById('loader-status');

  function setLoader(pct, status) {
    if (loaderBar) loaderBar.style.width = `${pct}%`;
    if (loaderStatus && status) loaderStatus.textContent = status;
  }

  function hideLoader() {
    setLoader(100, 'READY');
    setTimeout(() => loader?.classList.add('hidden'), 250);
  }

  // -----------------------------------------------------------------
  // Reflect logged-in user in the sidebar chrome
  // -----------------------------------------------------------------
  function renderUserChrome() {
    const user = Auth.currentUser();
    if (!user) return;

    const nameEl   = document.getElementById('user-name');
    const roleEl   = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');
    const adminSec = document.getElementById('nav-admin-section');

    if (nameEl)   nameEl.textContent = Auth.displayName();
    if (roleEl)   roleEl.textContent = Utils.roleLabel(Auth.role());
    if (avatarEl) avatarEl.textContent = Auth.initials();
    if (adminSec) adminSec.classList.toggle('hidden', !Auth.isAdmin());
  }

  // -----------------------------------------------------------------
  // Global event wiring
  // -----------------------------------------------------------------
  function wireGlobalUI() {
    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      await Auth.logout();
      Router.navigate('/login');
    });

    // Sidebar collapse (desktop)
    document.getElementById('sidebar-collapse-btn')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
    });

    // Sidebar toggle (mobile)
    document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => {
      const sb = document.getElementById('sidebar');
      sb?.classList.toggle('hidden');
    });

    // Notification bell — clears badge
    document.getElementById('notif-btn')?.addEventListener('click', () => {
      const badge = document.getElementById('notif-badge');
      badge?.classList.add('hidden');
    });

    // Login event -> refresh chrome + connect socket
    window.addEventListener('networkify:login', () => {
      renderUserChrome();
      SocketBus.connect();
    });

    // Logout event -> clear chrome
    window.addEventListener('networkify:logout', () => {
      const nameEl = document.getElementById('user-name');
      if (nameEl) nameEl.textContent = '—';
    });
  }

  // -----------------------------------------------------------------
  // Global socket notifications (toasts on job completion)
  // -----------------------------------------------------------------
  function wireSocketNotifications() {
    let notifCount = 0;
    const bumpNotif = () => {
      notifCount++;
      const badge = document.getElementById('notif-badge');
      if (badge) {
        badge.textContent = notifCount;
        badge.classList.remove('hidden');
      }
    };

    SocketBus.on('job_completed', (p) => {
      Toast.success(`${Utils.analysisTypeLabel(p.analysis_type)} completed`);
      bumpNotif();
    });
    SocketBus.on('job_failed', (p) => {
      Toast.error(`${Utils.analysisTypeLabel(p.analysis_type)} failed: ${p.error || 'unknown error'}`);
      bumpNotif();
    });
    SocketBus.on('feasibility_completed', (p) => {
      Toast.success(`Feasibility study complete — ${Utils.verdictLabel(p.verdict)}`);
      bumpNotif();
    });
    SocketBus.on('report_ready', () => {
      Toast.success('Report is ready to download');
      bumpNotif();
    });
  }

  // -----------------------------------------------------------------
  // Boot sequence
  // -----------------------------------------------------------------
  async function boot() {
    setLoader(15, 'LOADING MODULES...');

    wireGlobalUI();
    Router.init();

    setLoader(40, 'RESTORING SESSION...');

    let user = null;
    try {
      user = await Auth.init();
    } catch (e) {
      console.warn('[app] session restore failed:', e);
    }

    setLoader(70, 'CONNECTING...');

    if (user) {
      renderUserChrome();
      SocketBus.connect();
      wireSocketNotifications();
    }

    setLoader(90, 'STARTING...');

    // Default route
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      window.location.hash = user ? '#/dashboard' : '#/login';
    }

    await Router.render();

    Utils.icons();
    hideLoader();
  }

  // Kick off once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
