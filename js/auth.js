// Auth-Logik – Login & Registrierung
// Später wird hier Supabase Auth eingebunden

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const role = loginForm.dataset.role || 'schueler';
      // TODO: supabase.auth.signInWithPassword({ email, password })
      alert(`Login als ${role} mit ${email} – Supabase noch nicht verbunden.`);
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('reg-email').value;
      const role = registerForm.dataset.role || 'schueler';
      // TODO: supabase.auth.signUp({ email, password, options: { data: { role } } })
      alert(`Registrierung als ${role} mit ${email} – Supabase noch nicht verbunden.`);
    });
  }
});
