/* Admin authentication helpers + the login page. */
const Auth = {
  // Admin pages call this first. Not logged in -> straight to the login page.
  async requireAdmin() {
    try {
      const { user } = await Api.auth.me();
      return user;
    } catch (err) {
      if (err.status === 401 || err.status === 403) location.replace('/admin/login');
      else toast(err.message, 'error');
      throw err;
    }
  },
  async logout() {
    try { await Api.auth.logout(); } catch { /* cookie is cleared server-side; leave anyway */ }
    location.replace('/admin/login');
  },
};

(async function loginPage() {
  const form = $('#loginForm');
  if (!form) return;

  // Already signed in? Skip the form.
  try { await Api.auth.me(); location.replace('/admin/dashboard.html'); return; } catch { /* show the form */ }

  const alertBox = $('#loginAlert');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.className = '';
    alertBox.textContent = '';
    const button = $('button[type="submit"]', form);
    setBusy(button, true, 'Signing in');
    try {
      await Api.auth.login(form.elements.email.value.trim(), form.elements.password.value);
      location.replace('/admin/dashboard.html');
    } catch (err) {
      alertBox.className = 'alert alert-error';
      alertBox.textContent = err.message;
      setBusy(button, false);
    }
  });
})();
