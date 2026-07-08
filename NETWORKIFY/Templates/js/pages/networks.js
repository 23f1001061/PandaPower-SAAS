/* NETWORKIFY — pages/networks.js */
Pages.networks = (() => {

  let _page = 1;

  async function render(container) {
    container.innerHTML = Components.pageHeader({
      title: 'Networks',
      subtitle: 'Your power system models',
      actions: Components.primaryBtn({ id: 'new-network-btn', label: 'New Network', icon: 'plus' }),
    }) + `<div id="networks-body">${Components.loading('Loading networks...')}</div>`;
    Utils.icons();

    document.getElementById('new-network-btn').addEventListener('click', _openCreateModal);
    await _loadList();
  }

  async function _loadList() {
    const body = document.getElementById('networks-body');
    try {
      const res = await API.networks.list({ page: _page, per_page: CONFIG.DEFAULT_PAGE_SIZE });
      const nets = res.data?.networks || res.data || [];
      if (!nets.length) {
        body.innerHTML = Components.empty({
          icon: 'git-branch',
          message: 'No networks yet. Create one to start modelling, or load an IEEE test case.',
        });
        Utils.icons();
        return;
      }
      const rows = nets.map((n) => [
        `<a href="#/networks/${n.id}" class="text-brand-400 hover:text-brand-300 font-medium">${Utils.esc(n.name)}</a>`,
        `<span class="mono">${n.bus_count ?? '—'}</span>`,
        `<span class="mono">${n.line_count ?? '—'}</span>`,
        `<span class="mono">${Utils.num(n.base_mva, 0)} MVA</span>`,
        n.is_template ? '<span class="nw-badge nw-badge-blue">TEMPLATE</span>' : Utils.statusBadge(n.status),
        `<span class="mono">${Utils.relativeTime(n.updated_at || n.created_at)}</span>`,
        `<button class="nw-btn-danger" data-del="${n.id}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>`,
      ]);
      body.innerHTML = Components.card({
        body: Components.table({
          columns: ['Name', 'Buses', 'Lines', 'Base', 'Status', 'Updated', ''],
          rows,
        }),
      });

      const meta = res.pagination;
      const pager = Components.pagination(meta, (p) => { _page = p; _loadList(); });
      if (pager) body.appendChild(pager);

      body.querySelectorAll('button[data-del]').forEach((b) => {
        b.addEventListener('click', () => _confirmDelete(parseInt(b.dataset.del, 10)));
      });
      Utils.icons();
    } catch (err) {
      body.innerHTML = Components.empty({ icon: 'alert-circle', message: err.message });
      Utils.icons();
    }
  }

  function _openCreateModal() {
    Modal.open(`
      <h3 class="font-display text-xl tracking-wide text-ink-100 mb-4">New Network</h3>
      <form id="create-net-form" class="space-y-4">
        ${Components.field({ label: 'Name', name: 'name', required: true, placeholder: 'My Distribution Network' })}
        ${Components.field({ label: 'Base MVA', name: 'base_mva', type: 'number', value: '100', step: '0.1', min: '0.001' })}
        ${Components.selectField({ label: 'Frequency', name: 'freq_hz', value: '50',
          options: [{ value: '50', label: '50 Hz' }, { value: '60', label: '60 Hz' }] })}
        ${Components.field({ label: 'Description', name: 'description', placeholder: 'Optional' })}
        <div id="cn-error" class="hidden text-red-400 text-xs font-mono"></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="nw-btn-secondary" id="cn-cancel">Cancel</button>
          <button type="submit" class="nw-btn-primary" style="width:auto" id="cn-submit">Create</button>
        </div>
      </form>
    `);
    Utils.icons();
    document.getElementById('cn-cancel').onclick = Modal.close;
    document.getElementById('create-net-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name:        fd.get('name'),
        base_mva:    parseFloat(fd.get('base_mva')) || 100,
        freq_hz:     parseFloat(fd.get('freq_hz')) || 50,
        description: fd.get('description') || undefined,
      };
      const submit = document.getElementById('cn-submit');
      submit.disabled = true;
      try {
        const res = await API.networks.create(payload);
        Modal.close();
        Toast.success('Network created');
        const id = res.data?.network?.id;
        if (id) Router.navigate(`/networks/${id}`);
        else { _page = 1; _loadList(); }
      } catch (err) {
        const errBox = document.getElementById('cn-error');
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
        submit.disabled = false;
      }
    });
  }

  function _confirmDelete(id) {
    Modal.confirm({
      title: 'Delete network?',
      message: 'This permanently removes the network and all its elements and analyses.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await API.networks.remove(id);
          Toast.success('Network deleted');
          _loadList();
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  return { render };
})();
