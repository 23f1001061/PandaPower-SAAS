/* NETWORKIFY — pages/substations.js */
Pages.substations = (() => {

  let _page = 1;

  async function render(container) {
    const canCreate = Auth.isEngineer();
    container.innerHTML = Components.pageHeader({
      title: 'Substations',
      subtitle: 'Utility substation registry',
      actions: canCreate ? Components.primaryBtn({ id: 'new-sub-btn', label: 'Add Substation', icon: 'plus' }) : '',
    }) + `<div id="subs-body">${Components.loading('Loading substations...')}</div>`;
    Utils.icons();

    document.getElementById('new-sub-btn')?.addEventListener('click', _openCreateModal);
    await _loadList();
  }

  async function _loadList() {
    const body = document.getElementById('subs-body');
    try {
      const res = await API.substations.list({ page: _page, per_page: CONFIG.DEFAULT_PAGE_SIZE });
      const subs = res.data?.substations || res.data || [];
      if (!subs.length) {
        body.innerHTML = Components.empty({ icon: 'zap', message: 'No substations yet.' });
        Utils.icons();
        return;
      }
      const rows = subs.map((s) => [
        Utils.esc(s.name),
        `<span class="mono">${Utils.num(s.primary_voltage_kv, 0)} kV</span>`,
        Utils.esc(s.owner_utility || '—'),
        Utils.esc(s.city || s.region || '—'),
        s.transformer_capacity_mva != null ? `<span class="mono">${Utils.num(s.transformer_capacity_mva, 0)} MVA</span>` : '—',
        s.current_loading_percent != null ? `<span class="mono">${Utils.num(s.current_loading_percent, 0)}%</span>` : '—',
        s.is_active ? '<span class="nw-badge nw-badge-green">ACTIVE</span>' : '<span class="nw-badge nw-badge-slate">INACTIVE</span>',
      ]);
      body.innerHTML = Components.card({
        body: Components.table({
          columns: ['Name', 'Voltage', 'Utility', 'Location', 'Capacity', 'Loading', 'Status'],
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

  function _openCreateModal() {
    Modal.open(`
      <h3 class="font-display text-xl tracking-wide text-ink-100 mb-4">Add Substation</h3>
      <form id="sub-form" class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        ${Components.field({ label: 'Name', name: 'name', required: true })}
        <div class="grid grid-cols-2 gap-3">
          ${Components.field({ label: 'Latitude', name: 'latitude', type: 'number', step: 'any', required: true })}
          ${Components.field({ label: 'Longitude', name: 'longitude', type: 'number', step: 'any', required: true })}
        </div>
        ${Components.field({ label: 'Primary Voltage (kV)', name: 'primary_voltage_kv', type: 'number', step: 'any', required: true })}
        <div class="grid grid-cols-2 gap-3">
          ${Components.field({ label: 'Owner Utility', name: 'owner_utility' })}
          ${Components.field({ label: 'City', name: 'city' })}
        </div>
        ${Components.field({ label: 'Transformer Capacity (MVA)', name: 'transformer_capacity_mva', type: 'number', step: 'any' })}
        ${Components.field({ label: 'Current Loading (%)', name: 'current_loading_percent', type: 'number', step: 'any' })}
        <div id="sub-error" class="hidden text-red-400 text-xs font-mono"></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="nw-btn-secondary" id="sub-cancel">Cancel</button>
          <button type="submit" class="nw-btn-primary" style="width:auto" id="sub-submit">Add</button>
        </div>
      </form>
    `);
    Utils.icons();
    document.getElementById('sub-cancel').onclick = Modal.close;
    document.getElementById('sub-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const num = (k) => fd.get(k) ? parseFloat(fd.get(k)) : undefined;
      const payload = {
        name: fd.get('name'),
        latitude: num('latitude'), longitude: num('longitude'),
        primary_voltage_kv: num('primary_voltage_kv'),
        owner_utility: fd.get('owner_utility') || undefined,
        city: fd.get('city') || undefined,
        transformer_capacity_mva: num('transformer_capacity_mva'),
        current_loading_percent: num('current_loading_percent'),
      };
      const submit = document.getElementById('sub-submit');
      submit.disabled = true;
      try {
        await API.substations.create(payload);
        Modal.close();
        Toast.success('Substation added');
        _page = 1; _loadList();
      } catch (err) {
        const errBox = document.getElementById('sub-error');
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
        submit.disabled = false;
      }
    });
  }

  return { render };
})();
