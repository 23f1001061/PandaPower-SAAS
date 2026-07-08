/* NETWORKIFY — pages/dashboard.js */
Pages.dashboard = (() => {

  async function render(container) {
    container.innerHTML = Components.loading('Loading dashboard...');

    // Pull data in parallel; tolerate individual failures.
    const [networksRes, analysesRes, facilitiesRes, substationsRes] = await Promise.allSettled([
      API.networks.list({ per_page: 1 }),
      API.analyses.list({ per_page: 5 }),
      API.facilities.list({ per_page: 1 }),
      API.substations.list({ per_page: 1 }),
    ]);

    const count = (res) => res.status === 'fulfilled'
      ? (res.value.pagination?.total ?? res.value.data?.length ?? 0)
      : 0;

    const recentJobs = analysesRes.status === 'fulfilled'
      ? (analysesRes.value.data?.jobs || analysesRes.value.data || [])
      : [];

    const user = Auth.currentUser();

    container.innerHTML = `
      ${Components.pageHeader({
        title: `Welcome, ${Utils.esc(Auth.displayName())}`,
        subtitle: 'Power system analysis overview',
      })}

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        ${Components.statCard({ label: 'Networks',    value: count(networksRes),    icon: 'git-branch', accent: 'brand' })}
        ${Components.statCard({ label: 'Facilities',  value: count(facilitiesRes),  icon: 'factory',    accent: 'blue' })}
        ${Components.statCard({ label: 'Substations', value: count(substationsRes), icon: 'zap',        accent: 'green' })}
        ${Components.statCard({ label: 'Analyses Run',value: count(analysesRes),    icon: 'activity',   accent: 'brand' })}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          ${Components.card({
            header: 'Recent Analysis Jobs',
            body: _recentJobsTable(recentJobs),
          })}
        </div>
        <div>
          ${Components.card({
            header: 'Quick Actions',
            body: `
              <div class="space-y-2">
                <a href="#/networks" class="nw-btn-secondary w-full justify-start">
                  <i data-lucide="plus" class="w-4 h-4"></i> New Network
                </a>
                <a href="#/facilities" class="nw-btn-secondary w-full justify-start">
                  <i data-lucide="map-pin" class="w-4 h-4"></i> Check Site Feasibility
                </a>
                <a href="#/substations" class="nw-btn-secondary w-full justify-start">
                  <i data-lucide="zap" class="w-4 h-4"></i> Browse Substations
                </a>
                <a href="#/reports" class="nw-btn-secondary w-full justify-start">
                  <i data-lucide="file-bar-chart" class="w-4 h-4"></i> View Reports
                </a>
              </div>
            `,
          })}
        </div>
      </div>
    `;
    Utils.icons();
  }

  function _recentJobsTable(jobs) {
    if (!jobs.length) {
      return Components.empty({ icon: 'activity', message: 'No analyses run yet. Create a network and run your first analysis.' });
    }
    const rows = jobs.map((j) => [
      `<a href="#/analyses/${j.id}" class="text-brand-400 hover:text-brand-300 mono">#${j.id}</a>`,
      Utils.analysisTypeLabel(j.analysis_type),
      Utils.statusBadge(j.status),
      `<span class="mono">${Utils.relativeTime(j.created_at)}</span>`,
    ]);
    return Components.table({
      columns: ['Job', 'Type', 'Status', 'When'],
      rows,
    });
  }

  return { render };
})();
