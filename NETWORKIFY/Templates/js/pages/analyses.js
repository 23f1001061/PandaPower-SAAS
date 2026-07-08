/* NETWORKIFY — pages/analyses.js */
Pages.analyses = (() => {

  let _page = 1;
  let _filter = '';
  let _unsub = [];

  async function render(container) {
    container.innerHTML = Components.pageHeader({
      title: 'Analysis Jobs',
      subtitle: 'All power-system analyses',
    }) + `
      <div class="flex gap-2 mb-4 flex-wrap">
        ${_filterBtn('', 'All')}
        ${_filterBtn('load_flow', 'Load Flow')}
        ${_filterBtn('short_circuit', 'Short Circuit')}
        ${_filterBtn('contingency', 'Contingency')}
        ${_filterBtn('feasibility', 'Feasibility')}
      </div>
      <div id="jobs-body">${Components.loading('Loading jobs...')}</div>
    `;
    Utils.icons();

    container.querySelectorAll('button[data-filter]').forEach((b) => {
      b.addEventListener('click', () => {
        _filter = b.dataset.filter;
        _page = 1;
        render(container);
      });
    });

    // Live updates: refresh list on job state changes
    _unsub.push(SocketBus.on('job_started',   () => _loadList()));
    _unsub.push(SocketBus.on('job_completed', () => _loadList()));
    _unsub.push(SocketBus.on('job_failed',    () => _loadList()));

    await _loadList();
  }

  function _filterBtn(value, label) {
    const active = _filter === value;
    return `<button data-filter="${value}"
      class="px-3 py-1.5 font-mono text-xs tracking-wider uppercase rounded-lg border transition-colors
             ${active ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-ink-700 text-ink-500 hover:text-ink-300'}">
      ${label}</button>`;
  }

  async function _loadList() {
    const body = document.getElementById('jobs-body');
    if (!body) return;
    try {
      const params = { page: _page, per_page: CONFIG.DEFAULT_PAGE_SIZE };
      if (_filter) params.analysis_type = _filter;
      const res = await API.analyses.list(params);
      const jobs = res.data?.jobs || res.data || [];

      if (!jobs.length) {
        body.innerHTML = Components.empty({ icon: 'activity', message: 'No analysis jobs found.' });
        Utils.icons();
        return;
      }

      const rows = jobs.map((j) => [
        `<a href="#/analyses/${j.id}" class="text-brand-400 hover:text-brand-300 mono">#${j.id}</a>`,
        Utils.analysisTypeLabel(j.analysis_type),
        Utils.statusBadge(j.status),
        j.status === 'running'
          ? Components.progress(j.progress_pct || 0)
          : (j.converged === false ? '<span class="text-red-400 text-xs">diverged</span>' : '—'),
        `<span class="mono">${Utils.duration(j.duration_sec)}</span>`,
        `<span class="mono">${Utils.relativeTime(j.created_at)}</span>`,
      ]);

      body.innerHTML = Components.card({
        body: Components.table({
          columns: ['Job', 'Type', 'Status', 'Progress', 'Duration', 'When'],
          rows,
        }),
      });
      const pager = Components.pagination(res.pagination, (p) => { _page = p; _loadList(); });
      if (pager) body.appendChild(pager);
      Utils.icons();
    } catch (err) {
      body.innerHTML = Components.empty({ icon: 'alert-circle', message: err.message });
      Utils.icons();
    }
  }

  function cleanup() {
    _unsub.forEach((fn) => fn());
    _unsub = [];
  }

  return { render, cleanup };
})();
