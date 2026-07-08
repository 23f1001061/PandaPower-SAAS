/* NETWORKIFY — pages/login.js */
Pages.login = (() => {

  function render(container) {
    container.innerHTML = `
      <form id="login-form" class="space-y-4">
        <div>
          <label class="nw-label" for="login-email">Email</label>
          <input class="nw-input" id="login-email" name="email" type="email"
                 placeholder="you@example.com" required autocomplete="email" />
        </div>
        <div>
          <label class="nw-label" for="login-password">Password</label>
          <input class="nw-input" id="login-password" name="password" type="password"
                 placeholder="••••••••" required autocomplete="current-password" />
        </div>
        <div id="login-error" class="hidden text-red-400 text-xs font-mono"></div>
        <button type="submit" class="nw-btn-primary" id="login-submit">
          <span>Sign In</span>
        </button>
      </form>
      <p class="text-center text-ink-500 text-sm mt-6">
        No account?
        <a href="#/register" class="text-brand-400 hover:text-brand-300 font-medium">Create one</a>
      </p>
    `;

    const form   = document.getElementById('login-form');
    const errBox  = document.getElementById('login-error');
    const submit  = document.getElementById('login-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.classList.add('hidden');
      submit.disabled = true;
      submit.innerHTML = '<span class="nw-spinner"></span>';

      try {
        await Auth.login({
          email:    document.getElementById('login-email').value.trim(),
          password: document.getElementById('login-password').value,
        });
        Toast.success('Welcome back');
        Router.navigate('/dashboard');
      } catch (err) {
        errBox.textContent = err.message || 'Login failed';
        errBox.classList.remove('hidden');
        submit.disabled = false;
        submit.innerHTML = '<span>Sign In</span>';
      }
    });
  }

  return { render };
})();
