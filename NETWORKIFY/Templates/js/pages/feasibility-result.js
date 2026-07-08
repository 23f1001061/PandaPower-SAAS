/* NETWORKIFY — pages/feasibility-result.js
   The headline feature: map with facility + ranked substations +
   connecting line coloured by verdict, plus candidate table.
*/
Pages['feasibility-result'] = (() => {

  let _facId = null;
  let _studyId = null;
  let _map = null;

  async function render(container, params) {
    _facId = params.id;
    _studyId = params.studyId;
    container.innerHTML = Components.loading('Loading feasibility study...');

    let study, facility;
    try {
      const res = await API.facilities.getStudy(_facId, _studyId);
      study = res.data?.study || res.data;
      facility = res.data?.facility || study.facility;
      if (!facility) {
        const fRes = await API.facilities.get(_facId);
        facility = fRes.data?.facility || fRes.data;
      }
    } catch (err) {
      container.innerHTML = Components.empty({ icon: 'alert-circle', message: err.message });
      Utils.icons();
      return;
    }

    const checks = study.checks || [];
    const chosen = checks.find((c) => c.substation_id === study.chosen_substation_id) || checks[0];

    container.innerHTML = `
      ${Components.pageHeader({
        title: 'Feasibility Result',
        subtitle: Utils.esc(facility?.name || `Facility #${_facId}`),
        actions: Components.secondaryBtn({ label: 'Back', icon: 'arrow-left', href: `#/facilities/${_facId}` }),
      })}

      <div class="nw-card mb-6">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-xl bg-ink-800 border border-ink-700 flex items-center justify-center">
              <i data-lucide="${_verdictIcon(study.verdict)}" class="w-7 h-7 ${Utils.verdictTextClass(study.verdict)}"></i>
            </div>
            <div>
              <p class="font-mono text-[10px] tracking-widest uppercase text-ink-500">Verdict</p>
              <p class="font-display text-2xl ${Utils.verdictTextClass(study.verdict)}">${Utils.verdictLabel(study.verdict)}</p>
            </div>
          </div>
          <div class="flex gap-6">
            <div>
              <p class="font-mono text-[10px] tracking-widest uppercase text-ink-500">Candidates</p>
              <p class="font-display text-2xl text-ink-100">${checks.length}</p>
            </div>
            ${study.estimated_cost_inr_lakh != null ? `
            <div>
              <p class="font-mono text-[10px] tracking-widest uppercase text-ink-500">Est. Cost</p>
              <p class="font-display text-2xl text-brand-400">${Utils.inrLakh(study.estimated_cost_inr_lakh)}</p>
            </div>` : ''}
            ${study.estimated_lead_time_days != null ? `
            <div>
              <p class="font-mono text-[10px] tracking-widest uppercase text-ink-500">Lead Time</p>
              <p class="font-display text-2xl text-ink-100">${study.estimated_lead_time_days}d</p>
            </div>` : ''}
          </div>
        </div>
        ${study.recommendation ? `<p class="text-ink-300 text-sm mt-4 pt-4 border-t border-ink-800">${Utils.esc(study.recommendation)}</p>` : ''}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div class="lg:col-span-3 nw-card">
          <div class="nw-card-header">Site & Candidate Substations</div>
          <div id="feas-map" class="nw-map" style="height:420px"></div>
        </div>
        <div class="lg:col-span-2 nw-card">
          <div class="nw-card-header">Ranked Candidates</div>
          <div id="cand-list" class="space-y-2 max-h-[420px] overflow-y-auto">
            ${_candidateList(checks, study.chosen_substation_id)}
          </div>
        </div>
      </div>

      <div class="nw-card mt-6">
        <div class="nw-card-header">Candidate Detail</div>
        ${_candidateTable(checks)}
      </div>
    `;
    Utils.icons();

    _initMap(facility, checks, study);
  }

  function _verdictIcon(v) {
    return ({
      feasible: 'check-circle',
      feasible_with_upgrade: 'alert-triangle',
      not_feasible: 'x-circle',
      insufficient_data: 'help-circle',
    })[v] || 'help-circle';
  }

  function _candidateList(checks, chosenId) {
    if (!checks.length) {
      return Components.empty({ icon: 'zap-off', message: 'No substations found in range.' });
    }
    return checks.map((c, i) => `
      <div class="p-3 rounded-lg border ${c.substation_id === chosenId ? 'border-brand-500/50 bg-brand-500/5' : 'border-ink-700/60'}">
        <div class="flex items-center justify-between mb-1">
          <span class="font-mono text-xs text-ink-400">#${i + 1}</span>
          ${Utils.verdictBadge(c.verdict)}
        </div>
        <p class="text-sm text-ink-200 font-medium">${Utils.esc(c.substation?.name || 'Substation ' + c.substation_id)}</p>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 font-mono text-[11px] text-ink-500">
          <span>Dist: ${Utils.num(c.straight_distance_km, 1)} km</span>
          <span>Drop: ${Utils.num(c.voltage_drop_pct, 1)}%</span>
          <span>Head: ${c.headroom_mva != null ? Utils.num(c.headroom_mva, 0) + ' MVA' : '—'}</span>
          <span>Score: ${Utils.num(c.score, 2)}</span>
        </div>
      </div>
    `).join('');
  }

  function _candidateTable(checks) {
    if (!checks.length) return '<p class="text-ink-600 text-sm text-center py-6">No candidates</p>';
    const rows = checks.map((c, i) => [
      `<span class="mono">#${i + 1}</span>`,
      Utils.esc(c.substation?.name || c.substation_id),
      Utils.verdictBadge(c.verdict),
      `<span class="mono">${Utils.num(c.straight_distance_km, 2)}</span>`,
      `<span class="mono">${Utils.num(c.voltage_drop_pct, 2)}%</span>`,
      `<span class="mono">${c.headroom_mva != null ? Utils.num(c.headroom_mva, 1) : '—'}</span>`,
      `<span class="mono">${c.estimated_losses_kw != null ? Utils.num(c.estimated_losses_kw, 0) + ' kW' : '—'}</span>`,
      `<span class="mono">${Utils.num(c.score, 3)}</span>`,
    ]);
    return Components.table({
      columns: ['Rank', 'Substation', 'Verdict', 'Dist (km)', 'V-Drop', 'Headroom (MVA)', 'Losses', 'Score'],
      rows,
    });
  }

  function _initMap(facility, checks, study) {
    const elMap = document.getElementById('feas-map');
    if (!elMap || !facility) return;
    if (_map) { _map.remove(); _map = null; }

    _map = L.map(elMap).setView([facility.latitude, facility.longitude], 12);
    L.tileLayer(CONFIG.MAP_TILE_URL, { attribution: CONFIG.MAP_TILE_ATTRIBUTION }).addTo(_map);

    // Facility marker (blue)
    const facIcon = L.divIcon({
      className: '', html: '<span class="nw-marker-pulse nw-marker-facility"></span>',
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
    L.marker([facility.latitude, facility.longitude], { icon: facIcon }).addTo(_map)
      .bindPopup(`<b>${Utils.esc(facility.name)}</b><br>${Utils.mw(facility.demand_mw)} demand`);

    const bounds = [[facility.latitude, facility.longitude]];

    // Substation markers + connecting lines
    checks.forEach((c) => {
      const sub = c.substation;
      if (!sub || sub.latitude == null) return;
      const markerClass = CONFIG.FEASIBILITY_VERDICT_MARKER[c.verdict] || 'nw-marker-substation';
      const subIcon = L.divIcon({
        className: '', html: `<span class="nw-marker-pulse ${markerClass}"></span>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      L.marker([sub.latitude, sub.longitude], { icon: subIcon }).addTo(_map)
        .bindPopup(`
          <b>${Utils.esc(sub.name)}</b><br>
          ${Utils.kv(sub.primary_voltage_kv)} · ${Utils.num(c.straight_distance_km, 1)} km<br>
          Verdict: ${Utils.verdictLabel(c.verdict)}
        `);

      // Line from facility to this substation
      const isChosen = c.substation_id === study.chosen_substation_id;
      L.polyline(
        [[facility.latitude, facility.longitude], [sub.latitude, sub.longitude]],
        {
          color: Utils.colorForVerdict(c.verdict),
          weight: isChosen ? 3 : 1.5,
          opacity: isChosen ? 0.9 : 0.4,
          dashArray: isChosen ? null : '4 6',
        }
      ).addTo(_map);

      bounds.push([sub.latitude, sub.longitude]);
    });

    if (bounds.length > 1) {
      _map.fitBounds(bounds, { padding: [40, 40] });
    }
    setTimeout(() => _map.invalidateSize(), 100);
  }

  function cleanup() {
    if (_map) { _map.remove(); _map = null; }
  }

  return { render, cleanup };
})();
