/* NETWORKIFY — pages/register.js */
Pages.register = (() => {

  function render(container) {
    container.innerHTML = `
      <form id="reg-form" class="space-y-4">
        <div>
          <label class="nw-label" for="reg-username">Username</label>
          <input class="nw-input" id="reg-username" name="username" type="text"
                 placeholder="jsmith" required minlength="3" autocomplete="username" />
        </div>
        <div>
          <label class="nw-label" for="reg-email">Email</label>
          <input class="nw-input" id="reg-email" name="email" type="email"
                 placeholder="you@example.com" required autocomplete="email" />
        </div>
        <div>
          <label class="nw-label" for="reg-fullname">Full Name</label>
          <input class="nw-input" id="reg-fullname" name="full_name" type="text"
                 placeholder="Jane Smith" autocomplete="name" />
        </div>
        <div>
          <label class="nw-label" for="reg-company">Company <span class="text-ink-600">(optional)</span></label>
          <input class="nw-input" id="reg-company" name="company" type="text"
                 placeholder="Acme Power Consulting" />
        </div>
        <div>
          <label class="nw-label" for="reg-password">Password</label>
          <input class="nw-input" id="reg-password" name="password" type="password"
                 placeholder="At least 8 chars, 1 letter + 1 digit" required
                 autocomplete="new-password" />
        </div>
        <div id="reg-error" class="hidden text-red-400 text-xs font-mono"></div>
        <button type="submit" class="nw-btn-primary" id="reg-submit">
          <span>Create Account</span>
        </button>
      </form>
      <p class="text-center text-ink-500 text-sm mt-6">
        Already registered?
        <a href="#/login" class="text-brand-400 hover:text-brand-300 font-medium">Sign in</a>
      </p>
    `;

    const form   = document.getElementById('reg-form');
    const errBox = document.getElementById('reg-error');
    const submit = document.getElementById('reg-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.classList.add('hidden');
      submit.disabled = true;
      submit.innerHTML = '<span class="nw-spinner"></span>';

      const payload = {
        username:  document.getElementById('reg-username').value.trim(),
        email:     document.getElementById('reg-email').value.trim(),
        full_name: document.getElementById('reg-fullname').value.trim() || undefined,
        company:   document.getElementById('reg-company').value.trim() || undefined,
        password:  document.getElementById('reg-password').value,
      };

      try {
        await Auth.register(payload);
        Toast.success('Account created');
        Router.navigate('/dashboard');
      } catch (err) {
        const fe = err.fieldErrors || {};
        const msgs = Object.entries(fe).map(([k, v]) =>
          `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ');
        errBox.textContent = msgs || err.message || 'Registration failed';
        errBox.classList.remove('hidden');
        submit.disabled = false;
        submit.innerHTML = '<span>Create Account</span>';
      }
    });
  }

  return { render };
})();
