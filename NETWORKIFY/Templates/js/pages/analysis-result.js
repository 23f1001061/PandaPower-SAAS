/* NETWORKIFY — pages/analysis-result.js */
Pages['analysis-result'] = (() => {

  let _jobId = null;
  let _unsub = [];
  let _chart = null;

  async function render(container, params) {
    _jobId = params.id;
    container.innerHTML = Components.loading('Loading result...');

    await _load(container);

    // Live progress updates for running jobs
    _unsub.push(SocketBus.on('job_progress', (p) => {
      if (String(p.job_id) === String(_jobId)) _updateProgress(p);
    }));
    _unsub.push(SocketBus.on('job_completed', (p) => {
      if (String(p.job_id) === String(_jobId)) _load(container);
    }));
    _unsub.push(SocketBus.on('job_failed', (p) => {
      if (String(p.job_id) === String(_jobId)) _load(container);
    }));
  }

  async function _load(container) {
    let job, violations = [];
    try {
      const res = await API.analyses.get(_jobId, { include_results: true });
      job = res.data?.job || res.data;
      try {
        const vRes = await API.analyses.violations(_jobId);
        violations = vRes.data?.violations || vRes.data || [];
      } catch { /* no violations endpoint data */ }
    } catch (err) {
      container.innerHTML = Components.empty({ icon: 'alert-circle', message: err.message });
      Utils.icons();
      return;
    }

    const summary = job.results?.summary || {};
    const isRunning = job.status === 'running' || job.status === 'pending';

    container.innerHTML = `
      ${Components.pageHeader({
        title: `${Utils.analysisTypeLabel(job.analysis_type)} #${job.id}`,
        subtitle: `Network #${job.network_id}`,
        actions: `
          ${Components.secondaryBtn({ label: 'Back', icon: 'arrow-left', href: '#/analyses' })}
          ${job.status === 'completed' ? Components.primaryBtn({ id: 'gen-report-btn', label: 'Generate Report', icon: 'file-text' }) : ''}
          ${isRunning ? Components.secondaryBtn({ id: 'cancel-job-btn', label: 'Cancel', icon: 'x' }) : ''}
        `,
      })}

      <div class="flex items-center gap-3 mb-6">
        ${Utils.statusBadge(job.status)}
        ${job.converged === true ? '<span class="nw-badge nw-badge-green">CONVERGED</span>'
          : job.converged === false ? '<span class="nw-badge nw-badge-red">DIVERGED</span>' : ''}
        <span class="font-mono text-xs text-ink-500">${Utils.duration(job.duration_sec)}</span>
      </div>

      ${isRunning ? `
        <div class="nw-card mb-6">
          <div class="nw-card-header">Progress</div>
          ${Components.progress(job.progress_pct || 0, 'job-progress')}
          <p id="job-progress-label" class="font-mono text-xs text-ink-500 mt-2">${Utils.num(job.progress_pct || 0, 0)}%</p>
        </div>
      ` : ''}

      ${job.error_message ? `
        <div class="nw-card mb-6 border-red-500/40">
          <div class="nw-card-header text-red-400">Error</div>
          <p class="text-red-300 text-sm font-mono">${Utils.esc(job.error_message)}</p>
        </div>
      ` : ''}

      ${job.status === 'completed' ? _summaryCards(job.analysis_type, summary) : ''}

      ${violations.length ? `
        <div class="nw-card mt-6">
          <div class="nw-card-header">Violations (${violations.length})</div>
          ${_violationsTable(violations)}
        </div>
      ` : (job.status === 'completed' ? `
        <div class="nw-card mt-6">
          <div class="flex items-center gap-2 text-green-400">
            <i data-lucide="check-circle" class="w-5 h-5"></i>
            <span class="text-sm">No violations detected — network operates within limits.</span>
          </div>
        </div>
      ` : '')}

      ${summary.bus_voltages ? `
        <div class="nw-card mt-6">
          <div class="nw-card-header">Bus Voltage Profile</div>
          <div class="nw-chart-container"><canvas id="voltage-chart" height="100"></canvas></div>
        </div>
      ` : ''}
    `;
    Utils.icons();

    document.getElementById('gen-report-btn')?.addEventListener('click', _generateReport);
    document.getElementById('cancel-job-btn')?.addEventListener('click', _cancelJob);

    if (summary.bus_voltages) _renderVoltageChart(summary.bus_voltages);
  }

  function _summaryCards(type, s) {
    const cards = [];
    if (s.min_vm_pu != null) cards.push(Components.statCard({ label: 'Min Voltage', value: Utils.num(s.min_vm_pu, 3), sub: 'p.u.', accent: s.min_vm_pu < 0.95 ? 'red' : 'green' }));
    if (s.max_vm_pu != null) cards.push(Components.statCard({ label: 'Max Voltage', value: Utils.num(s.max_vm_pu, 3), sub: 'p.u.', accent: s.max_vm_pu > 1.05 ? 'red' : 'green' }));
    if (s.max_loading_percent != null) cards.push(Components.statCard({ label: 'Max Loading', value: Utils.num(s.max_loading_percent, 1), sub: '%', accent: s.max_loading_percent > 100 ? 'red' : 'brand' }));
    if (s.total_losses_mw != null) cards.push(Components.statCard({ label: 'Total Losses', value: Utils.num(s.total_losses_mw, 3), sub: 'MW', accent: 'brand' }));
    if (s.max_ikss_ka != null) cards.push(Components.statCard({ label: 'Max Ik″', value: Utils.num(s.max_ikss_ka, 2), sub: 'kA', accent: 'brand' }));
    if (!cards.length) return '';
    return `<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">${cards.join('')}</div>`;
  }

  function _violationsTable(violations) {
    const rows = violations.map((v) => [
      Utils.severityBadge(v.severity),
      Utils.esc(v.element_type || '—'),
      `<span class="mono">${v.element_index ?? '—'}</span>`,
      Utils.esc(v.violation_type || '—'),
      `<span class="mono">${Utils.num(v.value)} / ${Utils.num(v.limit)} ${Utils.esc(v.unit || '')}</span>`,
    ]);
    return Components.table({
      columns: ['Severity', 'Element', 'Idx', 'Type', 'Value / Limit'],
      rows,
    });
  }

  function _renderVoltageChart(buses) {
    const ctx = document.getElementById('voltage-chart');
    if (!ctx) return;
    if (_chart) _chart.destroy();
    const grid = Utils.cssVar('--chart-grid');
    const text = Utils.cssVar('--chart-text');
    _chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: buses.map((b) => b.name || `Bus ${b.index}`),
        datasets: [{
          label: 'Voltage (p.u.)',
          data: buses.map((b) => b.vm_pu),
          backgroundColor: buses.map((b) =>
            (b.vm_pu < 0.95 || b.vm_pu > 1.05) ? '#f87171' : '#f59e0b'),
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0.85, max: 1.15, grid: { color: grid }, ticks: { color: text, font: { family: 'JetBrains Mono' } } },
          x: { grid: { display: false }, ticks: { color: text, font: { family: 'JetBrains Mono', size: 9 } } },
        },
      },
    });
  }

  function _updateProgress(p) {
    const bar = document.querySelector('#job-progress .nw-progress-bar');
    const lbl = document.getElementById('job-progress-label');
    if (bar) bar.style.width = `${p.progress}%`;
    if (lbl) lbl.textContent = `${Utils.num(p.progress, 0)}% ${p.message ? '· ' + p.message : ''}`;
  }

  function _cancelJob() {
    Modal.confirm({
      title: 'Cancel job?', message: 'This stops the running analysis.',
      confirmLabel: 'Cancel Job', danger: true,
      onConfirm: async () => {
        try { await API.analyses.cancel(_jobId); Toast.info('Job cancelled'); }
        catch (err) { Toast.error(err.message); }
      },
    });
  }

  async function _generateReport() {
    try {
      await API.reports.create({ job_id: parseInt(_jobId, 10), format: 'pdf' });
      Toast.success('Report queued — check Reports page');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  function cleanup() {
    _unsub.forEach((fn) => fn());
    _unsub = [];
    if (_chart) { _chart.destroy(); _chart = null; }
  }

  return { render, cleanup };
})();
