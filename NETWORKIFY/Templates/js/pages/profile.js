/* NETWORKIFY — pages/profile.js */
Pages.profile = (() => {

  async function render(container) {
    const user = Auth.currentUser();
    if (!user) { Router.navigate('/login'); return; }

    container.innerHTML = `
      ${Components.pageHeader({ title: 'Profile', subtitle: 'Your account settings' })}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="nw-card">
          <div class="nw-card-header">Account Details</div>
          <form id="profile-form" class="space-y-4">
            ${Components.field({ label: 'Username', name: 'username', value: user.username, })}
            ${Components.field({ label: 'Email', name: 'email', value: user.email })}
            ${Components.field({ label: 'Full Name', name: 'full_name', value: user.full_name || '' })}
            ${Components.field({ label: 'Company', name: 'company', value: user.company || '' })}
            ${Components.field({ label: 'License Number', name: 'license_number', value: user.license_number || '' })}
            ${Components.field({ label: 'Phone', name: 'phone', value: user.phone || '' })}
            <div id="prof-error" class="hidden text-red-400 text-xs font-mono"></div>
            <button type="submit" class="nw-btn-primary" style="width:auto" id="prof-submit">Save Changes</button>
          </form>
          <p class="text-ink-600 text-xs font-mono mt-4">
            Username and email cannot be changed here. Role: ${Utils.roleLabel(user.role)}
          </p>
        </div>

        <div class="nw-card">
          <div class="nw-card-header">Change Password</div>
          <form id="pw-form" class="space-y-4">
            ${Components.field({ label: 'Current Password', name: 'current_password', type: 'password', required: true })}
            ${Components.field({ label: 'New Password', name: 'new_password', type: 'password', required: true, hint: 'At least 8 chars, 1 letter + 1 digit' })}
            <div id="pw-error" class="hidden text-red-400 text-xs font-mono"></div>
            <button type="submit" class="nw-btn-primary" style="width:auto" id="pw-submit">Update Password</button>
          </form>
        </div>
      </div>
    `;
    Utils.icons();

    // Disable read-only fields
    document.getElementById('f-username').setAttribute('disabled', '');
    document.getElementById('f-email').setAttribute('disabled', '');

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        full_name: fd.get('full_name') || undefined,
        company: fd.get('company') || undefined,
        license_number: fd.get('license_number') || undefined,
        phone: fd.get('phone') || undefined,
      };
      const submit = document.getElementById('prof-submit');
      submit.disabled = true;
      try {
        await Auth.updateProfile(payload);
        Toast.success('Profile updated');
        // refresh sidebar name
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = Auth.displayName();
      } catch (err) {
        const errBox = document.getElementById('prof-error');
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      } finally {
        submit.disabled = false;
      }
    });

    document.getElementById('pw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const submit = document.getElementById('pw-submit');
      submit.disabled = true;
      try {
        await API.auth.changePassword({
          current_password: fd.get('current_password'),
          new_password: fd.get('new_password'),
        });
        Toast.success('Password updated');
        e.target.reset();
      } catch (err) {
        const errBox = document.getElementById('pw-error');
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      } finally {
        submit.disabled = false;
      }
    });
  }

  return { render };
})();
