/* NETWORKIFY — pages/facilities.js */
Pages.facilities = (() => {

  let _page = 1;

  async function render(container) {
    container.innerHTML = Components.pageHeader({
      title: 'Facilities',
      subtitle: 'Proposed sites for grid feasibility',
      actions: Components.primaryBtn({ id: 'new-fac-btn', label: 'New Facility', icon: 'plus' }),
    }) + `<div id="fac-body">${Components.loading('Loading facilities...')}</div>`;
    Utils.icons();

    document.getElementById('new-fac-btn').addEventListener('click', _openCreateModal);
    await _loadList();
  }

  async function _loadList() {
    const body = document.getElementById('fac-body');
    try {
      const res = await API.facilities.list({ page: _page, per_page: CONFIG.DEFAULT_PAGE_SIZE });
      const facs = res.data?.facilities || res.data || [];
      if (!facs.length) {
        body.innerHTML = Components.empty({
          icon: 'factory',
          message: 'No facilities yet. Add a proposed site to run a grid feasibility study.',
        });
        Utils.icons();
        return;
      }
      const rows = facs.map((f) => [
        `<a href="#/facilities/${f.id}" class="text-brand-400 hover:text-brand-300 font-medium">${Utils.esc(f.name)}</a>`,
        Utils.facilityTypeLabel(f.facility_type),
        `<span class="mono">${Utils.num(f.demand_mw)} MW</span>`,
        `<span class="nw-badge nw-badge-slate">${(f.size_class || '').toUpperCase()}</span>`,
        Utils.esc(f.city || f.region || '—'),
        `<span class="mono">${Utils.relativeTime(f.created_at)}</span>`,
        `<button class="nw-btn-danger" data-del="${f.id}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>`,
      ]);
      body.innerHTML = Components.card({
        body: Components.table({
          columns: ['Name', 'Type', 'Demand', 'Size', 'Location', 'Created', ''],
          rows,
        }),
      });
      const pager = Components.pagination(res.pagination, (p) => { _page = p; _loadList(); });
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
      <h3 class="font-display text-xl tracking-wide text-ink-100 mb-4">New Facility</h3>
      <form id="fac-form" class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        ${Components.field({ label: 'Name', name: 'name', required: true, placeholder: 'ACME Manufacturing Plant' })}
        ${Components.selectField({ label: 'Facility Type', name: 'facility_type', value: 'factory', options: [
          { value: 'factory', label: 'Factory' },
          { value: 'data_centre', label: 'Data Centre' },
          { value: 'warehouse', label: 'Warehouse' },
          { value: 'office', label: 'Office' },
          { value: 'other', label: 'Other' },
        ]})}
        <div class="grid grid-cols-2 gap-3">
          ${Components.field({ label: 'Latitude', name: 'latitude', type: 'number', step: 'any', required: true })}
          ${Components.field({ label: 'Longitude', name: 'longitude', type: 'number', step: 'any', required: true })}
        </div>
        ${Components.field({ label: 'Demand (MW)', name: 'demand_mw', type: 'number', step: 'any', required: true })}
        <div class="grid grid-cols-2 gap-3">
          ${Components.field({ label: 'Power Factor', name: 'power_factor', type: 'number', step: '0.01', value: '0.9', min: '0.1', max: '1' })}
          ${Components.field({ label: 'City', name: 'city' })}
        </div>
        <div id="fac-error" class="hidden text-red-400 text-xs font-mono"></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="nw-btn-secondary" id="fac-cancel">Cancel</button>
          <button type="submit" class="nw-btn-primary" style="width:auto" id="fac-submit">Create</button>
        </div>
      </form>
    `);
    Utils.icons();
    document.getElementById('fac-cancel').onclick = Modal.close;
    document.getElementById('fac-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const num = (k) => fd.get(k) ? parseFloat(fd.get(k)) : undefined;
      const payload = {
        name: fd.get('name'),
        facility_type: fd.get('facility_type'),
        latitude: num('latitude'), longitude: num('longitude'),
        demand_mw: num('demand_mw'),
        power_factor: num('power_factor') || 0.9,
        city: fd.get('city') || undefined,
      };
      const submit = document.getElementById('fac-submit');
      submit.disabled = true;
      try {
        const res = await API.facilities.create(payload);
        Modal.close();
        Toast.success('Facility created');
        const id = res.data?.facility?.id;
        if (id) Router.navigate(`/facilities/${id}`);
        else { _page = 1; _loadList(); }
      } catch (err) {
        const errBox = document.getElementById('fac-error');
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
        submit.disabled = false;
      }
    });
  }

  function _confirmDelete(id) {
    Modal.confirm({
      title: 'Delete facility?',
      message: 'This removes the facility and its feasibility studies.',
      confirmLabel: 'Delete', danger: true,
      onConfirm: async () => {
        try { await API.facilities.remove(id); Toast.success('Facility deleted'); _loadList(); }
        catch (err) { Toast.error(err.message); }
      },
    });
  }

  return { render };
})();
