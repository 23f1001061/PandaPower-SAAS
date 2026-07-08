/* NETWORKIFY — pages/reports.js */
Pages.reports = (() => {

  let _page = 1;
  let _unsub = [];

  async function render(container) {
    container.innerHTML = Components.pageHeader({
      title: 'Reports',
      subtitle: 'Generated PDF and Excel exports',
    }) + `<div id="reports-body">${Components.loading('Loading reports...')}</div>`;
    Utils.icons();

    _unsub.push(SocketBus.on('report_ready', () => _loadList()));
    await _loadList();
  }

  async function _loadList() {
    const body = document.getElementById('reports-body');
    if (!body) return;
    try {
      const res = await API.reports.list({ page: _page, per_page: CONFIG.DEFAULT_PAGE_SIZE });
      const reports = res.data?.reports || res.data || [];
      if (!reports.length) {
        body.innerHTML = Components.empty({
          icon: 'file-bar-chart',
          message: 'No reports yet. Generate one from a completed analysis.',
        });
        Utils.icons();
        return;
      }
      const rows = reports.map((r) => [
        Utils.esc(r.title || `Report #${r.id}`),
        `<span class="nw-badge nw-badge-blue">${(r.format || '').toUpperCase()}</span>`,
        `<a href="#/analyses/${r.job_id}" class="text-brand-400 hover:text-brand-300 mono">#${r.job_id}</a>`,
        `<span class="mono">${Utils.fileSize(r.file_size_bytes)}</span>`,
        `<span class="mono">${Utils.relativeTime(r.created_at)}</span>`,
        `<button class="nw-btn-secondary" data-dl="${r.id}"><i data-lucide="download" class="w-3.5 h-3.5"></i> Download</button>`,
      ]);
      body.innerHTML = Components.card({
        body: Components.table({
          columns: ['Title', 'Format', 'Job', 'Size', 'Created', ''],
          rows,
        }),
      });
      const pager = Components.pagination(res.pagination, (p) => { _page = p; _loadList(); });
      if (pager) body.appendChild(pager);

      body.querySelectorAll('button[data-dl]').forEach((b) => {
        b.addEventListener('click', () => _download(parseInt(b.dataset.dl, 10), b));
      });
      Utils.icons();
    } catch (err) {
      body.innerHTML = Components.empty({ icon: 'alert-circle', message: err.message });
      Utils.icons();
    }
  }

  async function _download(id, btn) {
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="nw-spinner"></span>';
    try {
      const { blob, filename } = await API.reports.download(id);
      Utils.downloadBlob(blob, filename);
      Toast.success('Download started');
    } catch (err) {
      Toast.error(err.message || 'Report not ready yet');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
      Utils.icons();
    }
  }

  function cleanup() {
    _unsub.forEach((fn) => fn());
    _unsub = [];
  }

  return { render, cleanup };
})();
