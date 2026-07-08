/* NETWORKIFY — pages/network-detail.js
   Network detail view: element tables per tab + Add Element forms +
   Run Analysis. Element creation uses API.networks.createElement.
*/
Pages['network-detail'] = (() => {

  let _netId = null;
  let _activeTab = 'buses';
  let _net = null;   // cached last-loaded network payload (for bus dropdowns)

  // tab key -> { label, kind (API path segment) }
  const TABS = [
    { key: 'buses',        label: 'Buses',        kind: 'buses' },
    { key: 'lines',        label: 'Lines',        kind: 'lines' },
    { key: 'transformers', label: 'Transformers', kind: 'transformers' },
    { key: 'loads',        label: 'Loads',        kind: 'loads' },
    { key: 'generators',   label: 'Generators',   kind: 'generators' },
    { key: 'ext_grids',    label: 'Ext Grids',    kind: 'ext-grids' },
  ];

  async function render(container, params) {
    _netId = params.id;
    container.innerHTML = Components.loading('Loading network...');

    try {
      const res = await API.networks.get(_netId);
      _net = res.data;
    } catch (err) {
      container.innerHTML = Components.empty({ icon: 'alert-circle', message: err.message });
      Utils.icons();
      return;
    }

    const n = _net.network;
    const tab = TABS.find((t) => t.key === _activeTab);

    container.innerHTML = `
      ${Components.pageHeader({
        title: Utils.esc(n.name),
        subtitle: n.description || 'Power network model',
        actions: `
          ${Components.secondaryBtn({ label: 'Back', icon: 'arrow-left', href: '#/networks' })}
          ${Components.primaryBtn({ id: 'run-analysis-btn', label: 'Run Analysis', icon: 'play' })}
        `,
      })}

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        ${Components.statCard({ label: 'Buses',        value: _net.buses?.length ?? 0,        icon: 'circle-dot' })}
        ${Components.statCard({ label: 'Lines',        value: _net.lines?.length ?? 0,        icon: 'minus' })}
        ${Components.statCard({ label: 'Transformers', value: _net.transformers?.length ?? 0, icon: 'git-merge' })}
        ${Components.statCard({ label: 'Loads',        value: _net.loads?.length ?? 0,        icon: 'plug' })}
      </div>

      <div class="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div class="flex gap-1 border-b border-ink-800 overflow-x-auto">
          ${TABS.map((t) => `
            <button class="px-4 py-2 font-mono text-xs tracking-wider uppercase border-b-2 transition-colors whitespace-nowrap
                           ${t.key === _activeTab ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-300'}"
                    data-tab="${t.key}">${t.label}</button>
          `).join('')}
        </div>
        ${Components.primaryBtn({ id: 'add-element-btn', label: `Add ${_singular(tab.label)}`, icon: 'plus' })}
      </div>

      <div id="element-panel"></div>
    `;
    Utils.icons();

    document.getElementById('run-analysis-btn').addEventListener('click', () => _openRunModal(n));
    document.getElementById('add-element-btn').addEventListener('click', () => _openAddModal(_activeTab));
    container.querySelectorAll('button[data-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        _activeTab = b.dataset.tab;
        render(container, params);
      });
    });

    _renderTab(_net);
  }

  function _singular(label) {
    // "Buses" -> "Bus", "Lines" -> "Line", "Ext Grids" -> "Ext Grid"
    if (label === 'Buses') return 'Bus';
    return label.replace(/s$/, '');
  }

  function _renderTab(net) {
    const panel = document.getElementById('element-panel');
    const tab = TABS.find((t) => t.key === _activeTab);
    const items = net[_activeTab] || [];

    if (!items.length) {
      panel.innerHTML = Components.card({ body: Components.empty({
        icon: 'inbox',
        message: `No ${tab.label.toLowerCase()} yet. Click "Add ${_singular(tab.label)}" to create one.`,
      }) });
      Utils.icons();
      return;
    }

    let columns, rows;
    if (_activeTab === 'buses') {
      columns = ['Idx', 'Name', 'Vn (kV)', 'Type', 'In Service', ''];
      rows = items.map((b) => [
        `<span class="mono">${b.pp_index}</span>`, Utils.esc(b.name || '—'),
        `<span class="mono">${Utils.num(b.vn_kv, 1)}</span>`, b.bus_type || 'b',
        b.in_service ? '<span class="nw-badge nw-badge-green">YES</span>' : '<span class="nw-badge nw-badge-slate">NO</span>',
        _delBtn('buses', b.id),
      ]);
    } else if (_activeTab === 'lines') {
      columns = ['Idx', 'Name', 'From', 'To', 'Length (km)', 'In Service', ''];
      rows = items.map((l) => [
        `<span class="mono">${l.pp_index}</span>`, Utils.esc(l.name || '—'),
        `<span class="mono">${_busName(l.from_bus_id)}</span>`, `<span class="mono">${_busName(l.to_bus_id)}</span>`,
        `<span class="mono">${Utils.num(l.length_km, 2)}</span>`,
        l.in_service ? '<span class="nw-badge nw-badge-green">YES</span>' : '<span class="nw-badge nw-badge-slate">NO</span>',
        _delBtn('lines', l.id),
      ]);
    } else if (_activeTab === 'transformers') {
      columns = ['Idx', 'Name', 'HV Bus', 'LV Bus', 'Sn (MVA)', 'HV/LV (kV)', ''];
      rows = items.map((t) => [
        `<span class="mono">${t.pp_index}</span>`, Utils.esc(t.name || '—'),
        `<span class="mono">${_busName(t.hv_bus_id)}</span>`, `<span class="mono">${_busName(t.lv_bus_id)}</span>`,
        `<span class="mono">${Utils.num(t.sn_mva, 2)}</span>`,
        `<span class="mono">${Utils.num(t.vn_hv_kv, 0)}/${Utils.num(t.vn_lv_kv, 0)}</span>`,
        _delBtn('transformers', t.id),
      ]);
    } else if (_activeTab === 'loads') {
      columns = ['Idx', 'Name', 'Bus', 'P (MW)', 'Q (MVAr)', ''];
      rows = items.map((l) => [
        `<span class="mono">${l.pp_index}</span>`, Utils.esc(l.name || '—'),
        `<span class="mono">${_busName(l.bus_id)}</span>`, `<span class="mono">${Utils.num(l.p_mw)}</span>`,
        `<span class="mono">${Utils.num(l.q_mvar)}</span>`,
        _delBtn('loads', l.id),
      ]);
    } else if (_activeTab === 'generators') {
      columns = ['Idx', 'Name', 'Bus', 'P (MW)', 'Vm (p.u.)', 'Slack', ''];
      rows = items.map((g) => [
        `<span class="mono">${g.pp_index}</span>`, Utils.esc(g.name || '—'),
        `<span class="mono">${_busName(g.bus_id)}</span>`, `<span class="mono">${Utils.num(g.p_mw)}</span>`,
        `<span class="mono">${Utils.num(g.vm_pu, 3)}</span>`,
        g.slack ? '<span class="nw-badge nw-badge-amber">SLACK</span>' : '',
        _delBtn('generators', g.id),
      ]);
    } else { // ext_grids
      columns = ['Idx', 'Name', 'Bus', 'Vm (p.u.)', 'Va (°)', ''];
      rows = items.map((e) => [
        `<span class="mono">${e.pp_index}</span>`, Utils.esc(e.name || '—'),
        `<span class="mono">${_busName(e.bus_id)}</span>`, `<span class="mono">${Utils.num(e.vm_pu, 3)}</span>`,
        `<span class="mono">${Utils.num(e.va_degree, 2)}</span>`,
        _delBtn('ext-grids', e.id),
      ]);
    }

    panel.innerHTML = Components.card({ body: Components.table({ columns, rows }) });
    panel.querySelectorAll('button[data-del-kind]').forEach((b) => {
      b.addEventListener('click', () => _confirmDelete(b.dataset.delKind, parseInt(b.dataset.delId, 10)));
    });
    Utils.icons();
  }

  function _delBtn(kind, id) {
    return `<button class="nw-btn-danger" data-del-kind="${kind}" data-del-id="${id}">
      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>`;
  }

  // Resolve a bus DB id -> readable "pp_index:name" for tables
  function _busName(busId) {
    const bus = (_net?.buses || []).find((b) => b.id === busId);
    if (!bus) return busId ?? '—';
    return bus.name ? `${bus.pp_index}·${bus.name}` : `${bus.pp_index}`;
  }

  // Options list for bus dropdowns in forms
  function _busOptions() {
    return (_net?.buses || []).map((b) => ({
      value: b.id,
      label: b.name ? `[${b.pp_index}] ${b.name} (${Utils.num(b.vn_kv, 0)} kV)` : `Bus ${b.pp_index} (${Utils.num(b.vn_kv, 0)} kV)`,
    }));
  }

  // ==================================================================
  //  ADD ELEMENT MODALS
  // ==================================================================
  function _openAddModal(tabKey) {
    const buses = _busOptions();
    const needsBus = tabKey !== 'buses';

    // Guard: connecting elements require existing buses
    if (needsBus && buses.length === 0) {
      Modal.open(`
        <h3 class="font-display text-xl tracking-wide text-ink-100 mb-3">Add a Bus First</h3>
        <p class="text-ink-400 text-sm mb-6">
          ${_singular(TABS.find((t) => t.key === tabKey).label)}s connect to buses, but this
          network has none yet. Switch to the Buses tab and add at least one bus first
          (lines need two).
        </p>
        <div class="flex justify-end">
          <button class="nw-btn-primary" style="width:auto" id="goto-buses">Go to Buses</button>
        </div>
      `);
      document.getElementById('goto-buses').onclick = () => {
        Modal.close();
        _activeTab = 'buses';
        Router.render();
      };
      return;
    }

    const forms = {
      buses:        _busForm,
      lines:        () => _lineForm(buses),
      transformers: () => _transformerForm(buses),
      loads:        () => _loadForm(buses),
      generators:   () => _generatorForm(buses),
      ext_grids:    () => _extGridForm(buses),
    };
    const tab = TABS.find((t) => t.key === tabKey);
    const formHtml = forms[tabKey]();

    Modal.open(`
      <h3 class="font-display text-xl tracking-wide text-ink-100 mb-4">Add ${_singular(tab.label)}</h3>
      <form id="add-form" class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        ${formHtml}
        <div id="add-error" class="hidden text-red-400 text-xs font-mono"></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="nw-btn-secondary" id="add-cancel">Cancel</button>
          <button type="submit" class="nw-btn-primary" style="width:auto" id="add-submit">Add</button>
        </div>
      </form>
    `);
    Utils.icons();
    document.getElementById('add-cancel').onclick = Modal.close;
    document.getElementById('add-form').addEventListener('submit', (e) => _submitAdd(e, tab.kind, tabKey));
  }

  // ---- per-type field sets -----------------------------------------
  function _busForm() {
    return `
      ${Components.field({ label: 'Name', name: 'name', placeholder: 'e.g. Bus 1' })}
      ${Components.field({ label: 'Nominal Voltage (kV)', name: 'vn_kv', type: 'number', step: 'any', required: true, placeholder: '110' })}
      ${Components.selectField({ label: 'Bus Type', name: 'bus_type', value: 'b', options: [
        { value: 'b', label: 'b — busbar (PQ)' },
        { value: 'n', label: 'n — node' },
        { value: 'm', label: 'm — muff' },
      ]})}
    `;
  }

  function _lineForm(buses) {
    return `
      ${Components.field({ label: 'Name', name: 'name', placeholder: 'e.g. Line 1-2' })}
      ${Components.selectField({ label: 'From Bus', name: 'from_bus_id', required: true, options: buses })}
      ${Components.selectField({ label: 'To Bus', name: 'to_bus_id', required: true, options: buses })}
      ${Components.field({ label: 'Length (km)', name: 'length_km', type: 'number', step: 'any', required: true, value: '1.0' })}
      <p class="font-mono text-[10px] tracking-widest uppercase text-ink-600 pt-1">Per-km parameters</p>
      <div class="grid grid-cols-2 gap-3">
        ${Components.field({ label: 'R (Ω/km)', name: 'r_ohm_per_km', type: 'number', step: 'any', value: '0.1' })}
        ${Components.field({ label: 'X (Ω/km)', name: 'x_ohm_per_km', type: 'number', step: 'any', value: '0.2' })}
      </div>
      <div class="grid grid-cols-2 gap-3">
        ${Components.field({ label: 'C (nF/km)', name: 'c_nf_per_km', type: 'number', step: 'any', value: '10' })}
        ${Components.field({ label: 'Max I (kA)', name: 'max_i_ka', type: 'number', step: 'any', value: '1.0' })}
      </div>
    `;
  }

  function _transformerForm(buses) {
    return `
      ${Components.field({ label: 'Name', name: 'name', placeholder: 'e.g. T1' })}
      ${Components.selectField({ label: 'HV Bus', name: 'hv_bus_id', required: true, options: buses })}
      ${Components.selectField({ label: 'LV Bus', name: 'lv_bus_id', required: true, options: buses })}
      ${Components.field({ label: 'Rated Power Sn (MVA)', name: 'sn_mva', type: 'number', step: 'any', required: true, value: '40' })}
      <div class="grid grid-cols-2 gap-3">
        ${Components.field({ label: 'HV Voltage (kV)', name: 'vn_hv_kv', type: 'number', step: 'any', required: true, value: '110' })}
        ${Components.field({ label: 'LV Voltage (kV)', name: 'vn_lv_kv', type: 'number', step: 'any', required: true, value: '20' })}
      </div>
      <div class="grid grid-cols-2 gap-3">
        ${Components.field({ label: 'Short-circuit vk (%)', name: 'vk_percent', type: 'number', step: 'any', value: '12' })}
        ${Components.field({ label: 'Real part vkr (%)', name: 'vkr_percent', type: 'number', step: 'any', value: '0.5' })}
      </div>
    `;
  }

  function _loadForm(buses) {
    return `
      ${Components.field({ label: 'Name', name: 'name', placeholder: 'e.g. Load A' })}
      ${Components.selectField({ label: 'Bus', name: 'bus_id', required: true, options: buses })}
      <div class="grid grid-cols-2 gap-3">
        ${Components.field({ label: 'Active Power P (MW)', name: 'p_mw', type: 'number', step: 'any', value: '1.0' })}
        ${Components.field({ label: 'Reactive Q (MVAr)', name: 'q_mvar', type: 'number', step: 'any', value: '0.0' })}
      </div>
    `;
  }

  function _generatorForm(buses) {
    return `
      ${Components.field({ label: 'Name', name: 'name', placeholder: 'e.g. Gen 1' })}
      ${Components.selectField({ label: 'Bus', name: 'bus_id', required: true, options: buses })}
      <div class="grid grid-cols-2 gap-3">
        ${Components.field({ label: 'Active Power P (MW)', name: 'p_mw', type: 'number', step: 'any', value: '10' })}
        ${Components.field({ label: 'Voltage Vm (p.u.)', name: 'vm_pu', type: 'number', step: 'any', value: '1.0' })}
      </div>
      <label class="flex items-center gap-2 cursor-pointer pt-1">
        <input type="checkbox" name="slack" class="nw-checkbox" />
        <span class="text-sm text-ink-300">Slack (reference) generator</span>
      </label>
    `;
  }

  function _extGridForm(buses) {
    return `
      ${Components.field({ label: 'Name', name: 'name', placeholder: 'e.g. Grid' })}
      ${Components.selectField({ label: 'Bus', name: 'bus_id', required: true, options: buses })}
      <div class="grid grid-cols-2 gap-3">
        ${Components.field({ label: 'Voltage Vm (p.u.)', name: 'vm_pu', type: 'number', step: 'any', value: '1.0' })}
        ${Components.field({ label: 'Angle Va (°)', name: 'va_degree', type: 'number', step: 'any', value: '0.0' })}
      </div>
      ${Components.field({ label: 'Max SC Power (MVA)', name: 's_sc_max_mva', type: 'number', step: 'any', placeholder: 'optional, for short-circuit' })}
    `;
  }

  // ---- submit ------------------------------------------------------
  async function _submitAdd(e, kind, tabKey) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errBox = document.getElementById('add-error');
    const submit = document.getElementById('add-submit');

    const numOrUndef = (k) => {
      const v = fd.get(k);
      return (v === null || v === '') ? undefined : parseFloat(v);
    };
    const strOrUndef = (k) => {
      const v = fd.get(k);
      return (v === null || v === '') ? undefined : v;
    };

    let payload = {};
    if (tabKey === 'buses') {
      payload = { name: strOrUndef('name'), vn_kv: numOrUndef('vn_kv'), bus_type: fd.get('bus_type') || 'b' };
    } else if (tabKey === 'lines') {
      payload = {
        name: strOrUndef('name'),
        from_bus_id: parseInt(fd.get('from_bus_id'), 10),
        to_bus_id: parseInt(fd.get('to_bus_id'), 10),
        length_km: numOrUndef('length_km'),
        r_ohm_per_km: numOrUndef('r_ohm_per_km'),
        x_ohm_per_km: numOrUndef('x_ohm_per_km'),
        c_nf_per_km: numOrUndef('c_nf_per_km'),
        max_i_ka: numOrUndef('max_i_ka'),
      };
      if (payload.from_bus_id === payload.to_bus_id) {
        errBox.textContent = 'From and To buses must be different.';
        errBox.classList.remove('hidden');
        return;
      }
    } else if (tabKey === 'transformers') {
      payload = {
        name: strOrUndef('name'),
        hv_bus_id: parseInt(fd.get('hv_bus_id'), 10),
        lv_bus_id: parseInt(fd.get('lv_bus_id'), 10),
        sn_mva: numOrUndef('sn_mva'),
        vn_hv_kv: numOrUndef('vn_hv_kv'),
        vn_lv_kv: numOrUndef('vn_lv_kv'),
        vk_percent: numOrUndef('vk_percent'),
        vkr_percent: numOrUndef('vkr_percent'),
      };
      if (payload.hv_bus_id === payload.lv_bus_id) {
        errBox.textContent = 'HV and LV buses must be different.';
        errBox.classList.remove('hidden');
        return;
      }
    } else if (tabKey === 'loads') {
      payload = { name: strOrUndef('name'), bus_id: parseInt(fd.get('bus_id'), 10), p_mw: numOrUndef('p_mw'), q_mvar: numOrUndef('q_mvar') };
    } else if (tabKey === 'generators') {
      payload = {
        name: strOrUndef('name'), bus_id: parseInt(fd.get('bus_id'), 10),
        p_mw: numOrUndef('p_mw'), vm_pu: numOrUndef('vm_pu'),
        slack: fd.get('slack') === 'on',
      };
    } else if (tabKey === 'ext_grids') {
      payload = {
        name: strOrUndef('name'), bus_id: parseInt(fd.get('bus_id'), 10),
        vm_pu: numOrUndef('vm_pu'), va_degree: numOrUndef('va_degree'),
        s_sc_max_mva: numOrUndef('s_sc_max_mva'),
      };
    }

    errBox.classList.add('hidden');
    submit.disabled = true;
    submit.innerHTML = '<span class="nw-spinner"></span>';

    try {
      await API.networks.createElement(_netId, kind, payload);
      Modal.close();
      Toast.success(`${_singular(TABS.find((t) => t.key === tabKey).label)} added`);
      // Reload the network so tables + dropdowns refresh
      const res = await API.networks.get(_netId);
      _net = res.data;
      _renderTab(_net);
      _refreshStats();
    } catch (err) {
      const fe = err.fieldErrors || {};
      const msgs = Object.entries(fe).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ');
      errBox.textContent = msgs || err.message || 'Failed to add element';
      errBox.classList.remove('hidden');
      submit.disabled = false;
      submit.innerHTML = 'Add';
    }
  }

  function _refreshStats() {
    // Lightweight: re-render counts in the four stat cards without full reload
    const counts = {
      buses: _net.buses?.length ?? 0,
      lines: _net.lines?.length ?? 0,
      transformers: _net.transformers?.length ?? 0,
      loads: _net.loads?.length ?? 0,
    };
    const cards = document.querySelectorAll('.nw-stat-card .font-display');
    if (cards[0]) cards[0].textContent = counts.buses;
    if (cards[1]) cards[1].textContent = counts.lines;
    if (cards[2]) cards[2].textContent = counts.transformers;
    if (cards[3]) cards[3].textContent = counts.loads;
  }

  // ==================================================================
  //  DELETE
  // ==================================================================
  function _confirmDelete(kind, id) {
    Modal.confirm({
      title: 'Delete element?',
      message: 'This removes the element from the network.',
      confirmLabel: 'Delete', danger: true,
      onConfirm: async () => {
        try {
          await API.networks.deleteElement(_netId, kind, id);
          Toast.success('Element deleted');
          const res = await API.networks.get(_netId);
          _net = res.data;
          _renderTab(_net);
          _refreshStats();
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  // ==================================================================
  //  RUN ANALYSIS
  // ==================================================================
  function _openRunModal(network) {
    Modal.open(`
      <h3 class="font-display text-xl tracking-wide text-ink-100 mb-4">Run Analysis</h3>
      <form id="run-form" class="space-y-4">
        ${Components.selectField({ label: 'Analysis Type', name: 'type', options: [
          { value: 'load_flow',     label: 'Load Flow' },
          { value: 'short_circuit', label: 'Short Circuit (IEC 60909)' },
          { value: 'contingency',   label: 'Contingency (N-1)' },
          { value: 'opf',           label: 'Optimal Power Flow' },
        ]})}
        <div id="run-error" class="hidden text-red-400 text-xs font-mono"></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="nw-btn-secondary" id="run-cancel">Cancel</button>
          <button type="submit" class="nw-btn-primary" style="width:auto" id="run-submit">
            <i data-lucide="play" class="w-4 h-4"></i> Run
          </button>
        </div>
      </form>
    `);
    Utils.icons();
    document.getElementById('run-cancel').onclick = Modal.close;
    document.getElementById('run-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = new FormData(e.target).get('type');
      const submit = document.getElementById('run-submit');
      submit.disabled = true;
      try {
        const payload = { network_id: parseInt(_netId, 10) };
        let res;
        if (type === 'load_flow')     res = await API.analyses.runLoadFlow(payload);
        if (type === 'short_circuit') res = await API.analyses.runShortCircuit(payload);
        if (type === 'contingency')   res = await API.analyses.runContingency(payload);
        if (type === 'opf')           res = await API.analyses.runOpf(payload);
        Modal.close();
        Toast.success('Analysis queued');
        const jobId = res.data?.job?.id;
        if (jobId) Router.navigate(`/analyses/${jobId}`);
      } catch (err) {
        const errBox = document.getElementById('run-error');
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
        submit.disabled = false;
      }
    });
  }

  return { render };
})();
