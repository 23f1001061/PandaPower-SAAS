/* NETWORKIFY — pages/facility-detail.js */
Pages['facility-detail'] = (() => {

  let _facId = null;
  let _map = null;
  let _unsub = [];

  async function render(container, params) {
    _facId = params.id;
    container.innerHTML = Components.loading('Loading facility...');

    let fac, studies = [];
    try {
      const res = await API.facilities.get(_facId);
      fac = res.data?.facility || res.data;
      const sRes = await API.facilities.listStudies(_facId);
      studies = sRes.data?.studies || sRes.data || [];
    } catch (err) {
      container.innerHTML = Components.empty({ icon: 'alert-circle', message: err.message });
      Utils.icons();
      return;
    }

    container.innerHTML = `
      ${Components.pageHeader({
        title: Utils.esc(fac.name),
        subtitle: `${Utils.facilityTypeLabel(fac.facility_type)} · ${Utils.mw(fac.demand_mw)}`,
        actions: `
          ${Components.secondaryBtn({ label: 'Back', icon: 'arrow-left', href: '#/facilities' })}
          ${Components.primaryBtn({ id: 'run-feas-btn', label: 'Run Feasibility', icon: 'search-check' })}
        `,
      })}

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        ${Components.statCard({ label: 'Demand',     value: Utils.num(fac.demand_mw), sub: 'MW', icon: 'zap' })}
        ${Components.statCard({ label: 'Apparent',   value: Utils.num(fac.demand_mva), sub: 'MVA', icon: 'gauge', accent: 'blue' })}
        ${Components.statCard({ label: 'Power Factor',value: Utils.num(fac.power_factor, 2), icon: 'activity', accent: 'green' })}
        ${Components.statCard({ label: 'Size Class', value: (fac.size_class || '—').toUpperCase(), icon: 'maximize' })}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="nw-card">
          <div class="nw-card-header">Location</div>
          <div id="fac-map" class="nw-map" style="height:280px"></div>
          <p class="font-mono text-xs text-ink-500 mt-3">
            ${Utils.num(fac.latitude, 5)}, ${Utils.num(fac.longitude, 5)}
            ${fac.city ? '· ' + Utils.esc(fac.city) : ''}
          </p>
        </div>
        <div class="nw-card">
          <div class="nw-card-header">Feasibility Studies</div>
          <div id="studies-list">${_studiesList(studies)}</div>
        </div>
      </div>
    `;
    Utils.icons();

    document.getElementById('run-feas-btn').addEventListener('click', () => _runFeasibility(fac));
    _initMap(fac);

    // Live: refresh when a feasibility study completes
    _unsub.push(SocketBus.on('feasibility_completed', () => render(container, params)));
  }

  function _studiesList(studies) {
    if (!studies.length) {
      return Components.empty({ icon: 'search', message: 'No studies yet. Run a feasibility check.' });
    }
    return studies.map((s) => `
      <a href="#/facilities/${_facId}/studies/${s.id}"
         class="flex items-center justify-between p-3 rounded-lg border border-ink-700/60
                hover:border-brand-500/40 transition-colors mb-2">
        <div>
          <div class="flex items-center gap-2">
            ${Utils.verdictBadge(s.verdict)}
            <span class="font-mono text-xs text-ink-500">${Utils.num(s.search_radius_km, 0)} km radius</span>
          </div>
          <p class="text-ink-400 text-xs mt-1">${Utils.relativeTime(s.created_at)}</p>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-ink-600"></i>
      </a>
    `).join('');
  }

  function _initMap(fac) {
    const elMap = document.getElementById('fac-map');
    if (!elMap || _map) return;
    _map = L.map(elMap).setView([fac.latitude, fac.longitude], 13);
    L.tileLayer(CONFIG.MAP_TILE_URL, { attribution: CONFIG.MAP_TILE_ATTRIBUTION }).addTo(_map);
    L.marker([fac.latitude, fac.longitude]).addTo(_map)
      .bindPopup(`<b>${Utils.esc(fac.name)}</b><br>${Utils.mw(fac.demand_mw)}`);
    setTimeout(() => _map.invalidateSize(), 100);
  }

  function _runFeasibility(fac) {
    Modal.open(`
      <h3 class="font-display text-xl tracking-wide text-ink-100 mb-4">Run Feasibility Study</h3>
      <form id="feas-form" class="space-y-4">
        ${Components.field({ label: 'Search Radius (km)', name: 'search_radius_km', type: 'number', step: 'any', value: '15', min: '0.5', max: '200' })}
        ${Components.field({ label: 'Max Voltage Drop (%)', name: 'max_voltage_drop_pct', type: 'number', step: 'any', value: '5', min: '0.1', max: '30' })}
        ${Components.field({ label: 'Min Headroom Factor', name: 'min_headroom_factor', type: 'number', step: '0.1', value: '1.2', min: '1', max: '10' })}
        <div id="feas-error" class="hidden text-red-400 text-xs font-mono"></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="nw-btn-secondary" id="feas-cancel">Cancel</button>
          <button type="submit" class="nw-btn-primary" style="width:auto" id="feas-submit">
            <i data-lucide="search-check" class="w-4 h-4"></i> Run
          </button>
        </div>
      </form>
    `);
    Utils.icons();
    document.getElementById('feas-cancel').onclick = Modal.close;
    document.getElementById('feas-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        search_radius_km: parseFloat(fd.get('search_radius_km')) || 15,
        max_voltage_drop_pct: parseFloat(fd.get('max_voltage_drop_pct')) || 5,
        min_headroom_factor: parseFloat(fd.get('min_headroom_factor')) || 1.2,
      };
      const submit = document.getElementById('feas-submit');
      submit.disabled = true;
      try {
        const res = await API.facilities.runFeasibility(_facId, payload);
        Modal.close();
        Toast.success('Feasibility study queued');
        const studyId = res.data?.study?.id;
        if (studyId) Router.navigate(`/facilities/${_facId}/studies/${studyId}`);
      } catch (err) {
        const errBox = document.getElementById('feas-error');
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
        submit.disabled = false;
      }
    });
  }

  function cleanup() {
    _unsub.forEach((fn) => fn());
    _unsub = [];
    if (_map) { _map.remove(); _map = null; }
  }

  return { render, cleanup };
})();
