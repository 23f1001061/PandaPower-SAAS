/* NETWORKIFY — pages/admin.js */
Pages.admin = (() => {

  let _activeTab = 'stats';

  const TABS = [
    { key: 'stats', label: 'Statistics' },
    { key: 'audit', label: 'Audit Logs' },
    { key: 'plans', label: 'Plans' },
  ];

  async function render(container) {
    if (!Auth.isAdmin()) { Router.navigate('/dashboard'); return; }

    container.innerHTML = Components.pageHeader({
      title: 'Administration',
      subtitle: 'System overview and management',
    }) + `
      <div class="flex gap-1 mb-4 border-b border-ink-800">
        ${TABS.map((t) => `
          <button class="px-4 py-2 font-mono text-xs tracking-wider uppercase border-b-2 transition-colors
                         ${t.key === _activeTab ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-300'}"
                  data-tab="${t.key}">${t.label}</button>
        `).join('')}
      </div>
      <div id="admin-panel">${Components.loading()}</div>
    `;
    Utils.icons();

    container.querySelectorAll('button[data-tab]').forEach((b) => {
      b.addEventListener('click', () => { _activeTab = b.dataset.tab; render(container); });
    });

    if (_activeTab === 'stats') await _renderStats();
    else if (_activeTab === 'audit') await _renderAudit();
    else if (_activeTab === 'plans') await _renderPlans();
  }

  async function _renderStats() {
    const panel = document.getElementById('admin-panel');
    try {
      const res = await API.admin.stats();
      const s = res.data || {};
      panel.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          ${Components.statCard({ label: 'Total Users',   value: s.total_users ?? '—',   icon: 'users' })}
          ${Components.statCard({ label: 'Active Users',  value: s.active_users ?? '—',  icon: 'user-check', accent: 'green' })}
          ${Components.statCard({ label: 'Networks',      value: s.total_networks ?? '—',icon: 'git-branch' })}
          ${Components.statCard({ label: 'Facilities',    value: s.total_facilities ?? '—', icon: 'factory', accent: 'blue' })}
          ${Components.statCard({ label: 'Substations',   value: s.total_substations ?? '—', icon: 'zap' })}
          ${Components.statCard({ label: 'Total Analyses',value: s.total_analyses ?? '—',icon: 'activity' })}
          ${Components.statCard({ label: 'Running Jobs',  value: s.running_jobs ?? '—',  icon: 'loader', accent: 'brand' })}
          ${Components.statCard({ label: 'Reports',       value: s.total_reports ?? '—', icon: 'file-text' })}
        </div>
      `;
      Utils.icons();
    } catch (err) {
      panel.innerHTML = Components.empty({ icon: 'alert-circle', message: err.message });
      Utils.icons();
    }
  }

  async function _renderAudit() {
    const panel = document.getElementById('admin-panel');
    try {
      const res = await API.admin.auditLogs({ per_page: 50 });
      const logs = res.data?.logs || res.data || [];
      if (!logs.length) {
        panel.innerHTML = Components.empty({ icon: 'scroll-text', message: 'No audit logs.' });
        Utils.icons();
        return;
      }
      const rows = logs.map((l) => [
        `<span class="mono">${Utils.datetime(l.created_at)}</span>`,
        `<span class="mono">${l.user_id ?? '—'}</span>`,
        Utils.esc(l.action || '—'),
        Utils.esc(l.resource_type || '—'),
        l.success === false ? '<span class="nw-badge nw-badge-red">FAIL</span>' : '<span class="nw-badge nw-badge-green">OK</span>',
        `<span class="mono text-xs">${Utils.esc(l.ip_address || '—')}</span>`,
      ]);
      panel.innerHTML = Components.card({
        body: Components.table({
          columns: ['Time', 'User', 'Action', 'Resource', 'Result', 'IP'],
          rows,
        }),
      });
      Utils.icons();
    } catch (err) {
      panel.innerHTML = Components.empty({ icon: 'alert-circle', message: err.message });
      Utils.icons();
    }
  }

  async function _renderPlans() {
    const panel = document.getElementById('admin-panel');
    try {
      const res = await API.admin.listPlans();
      const plans = res.data?.plans || res.data || [];
      if (!plans.length) {
        panel.innerHTML = Components.empty({ icon: 'credit-card', message: 'No plans configured. Run seed_plans.' });
        Utils.icons();
        return;
      }
      panel.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          ${plans.map((p) => `
            <div class="nw-card">
              <div class="flex items-center justify-between mb-3">
                <span class="font-display text-xl text-brand-400">${Utils.esc(p.name)}</span>
                ${p.is_active ? '<span class="nw-badge nw-badge-green">ACTIVE</span>' : '<span class="nw-badge nw-badge-slate">OFF</span>'}
              </div>
              <p class="font-display text-3xl text-ink-100 mb-3">
                ${p.price_inr_per_month != null ? '₹' + Utils.num(p.price_inr_per_month, 0) : 'Custom'}
                <span class="text-sm text-ink-500 font-body">/mo</span>
              </p>
              <ul class="space-y-1 font-mono text-xs text-ink-400">
                <li>Networks: ${p.limits?.max_networks ?? '∞'}</li>
                <li>Buses/net: ${p.limits?.max_buses_per_network ?? '∞'}</li>
                <li>Analyses/mo: ${p.limits?.max_analyses_per_month ?? '∞'}</li>
                <li>Contingency: ${p.features?.contingency ? '✓' : '✗'}</li>
                <li>OPF: ${p.features?.opf ? '✓' : '✗'}</li>
                <li>API access: ${p.features?.api_access ? '✓' : '✗'}</li>
              </ul>
            </div>
          `).join('')}
        </div>
      `;
      Utils.icons();
    } catch (err) {
      panel.innerHTML = Components.empty({ icon: 'alert-circle', message: err.message });
      Utils.icons();
    }
  }

  return { render };
})();
