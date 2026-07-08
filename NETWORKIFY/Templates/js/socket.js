/* =====================================================================
   NETWORKIFY — socket.js
   Socket.IO client wrapper for the /analysis namespace.

   Responsibilities:
     - Connect once the user is authenticated, passing the JWT
       in `auth.token` (per Sockets/analysis_socket.py contract).
     - Re-emit backend events through a tiny pub/sub so page modules
       can subscribe without touching socket.io directly.
     - Drive the sidebar connection dot + "N LIVE" badge + topbar
       "job running" indicator.
     - Fall back to polling (handled by analyses.js) if the socket
       never connects — this module just reports its own state.

   Depends on: config.js, auth.js
   Used by:    app.js, analyses.js, analysis-result.js,
               facility-detail.js, feasibility-result.js, reports.js
===================================================================== */

const SocketBus = (() => {

  let _socket = null;
  let _connected = false;
  let _runningJobs = new Set();

  const _listeners = {}; // event name -> Set<fn>

  // -----------------------------------------------------------------
  // Connection lifecycle
  // -----------------------------------------------------------------
  function connect() {
    if (_socket) return _socket;

    const token = API.getAccessToken();
    if (!token) return null;

    _socket = io(CONFIG.SOCKET_URL + CONFIG.SOCKET_NAMESPACE, {
      path: CONFIG.SOCKET_PATH,
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });

    _socket.on('connect', () => {
      _connected = true;
      _updateStatusUI();
      _emitLocal('connect', {});
    });

    _socket.on('disconnect', () => {
      _connected = false;
      _updateStatusUI();
      _emitLocal('disconnect', {});
    });

    _socket.on('connect_error', (err) => {
      _connected = false;
      _updateStatusUI(true);
      _emitLocal('connect_error', err);
    });

    _socket.on('connected', (payload) => _emitLocal('connected', payload));
    _socket.on('error',     (payload) => _emitLocal('error', payload));

    // ---- Job lifecycle events --------------------------------------
    _socket.on('job_queued', (payload) => {
      _trackRunning(payload.job_id, true);
      _emitLocal('job_queued', payload);
    });
    _socket.on('job_started', (payload) => {
      _trackRunning(payload.job_id, true);
      _emitLocal('job_started', payload);
    });
    _socket.on('job_progress', (payload) => {
      _emitLocal('job_progress', payload);
    });
    _socket.on('job_completed', (payload) => {
      _trackRunning(payload.job_id, false);
      _emitLocal('job_completed', payload);
    });
    _socket.on('job_failed', (payload) => {
      _trackRunning(payload.job_id, false);
      _emitLocal('job_failed', payload);
    });
    _socket.on('job_cancelled', (payload) => {
      _trackRunning(payload.job_id, false);
      _emitLocal('job_cancelled', payload);
    });

    // ---- Feasibility + reports --------------------------------------
    _socket.on('feasibility_completed', (payload) => _emitLocal('feasibility_completed', payload));
    _socket.on('report_ready',          (payload) => _emitLocal('report_ready', payload));

    return _socket;
  }

  function disconnect() {
    if (_socket) {
      _socket.disconnect();
      _socket = null;
    }
    _connected = false;
    _runningJobs.clear();
    _updateStatusUI();
    _updateRunningBadge();
  }

  function isConnected() {
    return _connected;
  }

  // -----------------------------------------------------------------
  // Job room subscriptions (for shared/admin views)
  // -----------------------------------------------------------------
  function subscribeJob(jobId) {
    if (!_socket) return;
    _socket.emit('subscribe_job', { job_id: jobId, token: API.getAccessToken() });
  }

  function unsubscribeJob(jobId) {
    if (!_socket) return;
    _socket.emit('unsubscribe_job', { job_id: jobId });
  }

  // -----------------------------------------------------------------
  // Local pub/sub — page modules call SocketBus.on(event, fn)
  // -----------------------------------------------------------------
  function on(event, fn) {
    if (!_listeners[event]) _listeners[event] = new Set();
    _listeners[event].add(fn);
    return () => off(event, fn); // return unsubscribe fn
  }

  function off(event, fn) {
    _listeners[event]?.delete(fn);
  }

  function _emitLocal(event, payload) {
    _listeners[event]?.forEach((fn) => {
      try { fn(payload); } catch (e) { console.error(`[SocketBus] listener error (${event}):`, e); }
    });
  }

  // -----------------------------------------------------------------
  // Running-job tracking (drives sidebar badge + topbar pill)
  // -----------------------------------------------------------------
  function _trackRunning(jobId, isRunning) {
    if (jobId === undefined || jobId === null) return;
    if (isRunning) _runningJobs.add(jobId);
    else _runningJobs.delete(jobId);
    _updateRunningBadge();
  }

  function runningCount() {
    return _runningJobs.size;
  }

  // -----------------------------------------------------------------
  // UI updates — sidebar dot + label, nav badge, topbar pill
  // -----------------------------------------------------------------
  function _updateStatusUI(isError = false) {
    const dot   = document.getElementById('socket-dot');
    const label = document.getElementById('socket-label');
    if (!dot || !label) return;

    dot.classList.remove('nw-status-dot-live', 'nw-status-dot-error', 'bg-ink-600');

    if (_connected) {
      dot.classList.add('nw-status-dot-live');
      label.textContent = 'LIVE';
      label.classList.remove('text-red-400');
      label.classList.add('text-ink-500');
    } else if (isError) {
      dot.classList.add('nw-status-dot-error');
      label.textContent = 'OFFLINE';
      label.classList.add('text-red-400');
    } else {
      dot.classList.add('bg-ink-600');
      label.textContent = 'CONNECTING';
      label.classList.remove('text-red-400');
      label.classList.add('text-ink-500');
    }
  }

  function _updateRunningBadge() {
    const navBadge   = document.getElementById('nav-running-badge');
    const navCount   = document.getElementById('nav-running-count');
    const topbar     = document.getElementById('topbar-job-indicator');
    const topbarText = document.getElementById('topbar-job-label');

    const count = _runningJobs.size;

    if (navBadge && navCount) {
      navCount.textContent = count;
      navBadge.classList.toggle('hidden', count === 0);
    }
    if (topbar && topbarText) {
      if (count > 0) {
        topbar.classList.remove('hidden');
        topbar.classList.add('flex');
        topbarText.textContent = count === 1 ? '1 JOB RUNNING' : `${count} JOBS RUNNING`;
      } else {
        topbar.classList.add('hidden');
        topbar.classList.remove('flex');
      }
    }
  }

  return {
    connect,
    disconnect,
    isConnected,
    subscribeJob,
    unsubscribeJob,
    on,
    off,
    runningCount,
  };
})();


// -----------------------------------------------------------------
// Wire connection lifecycle to auth events
// -----------------------------------------------------------------
window.addEventListener('networkify:login', () => {
  SocketBus.connect();
});
window.addEventListener('networkify:logout', () => {
  SocketBus.disconnect();
});
