// Entry-gate sign-in screen, styled after dndbnb's account screen (username +
// password, sign-in / sign-up toggle). The form is a visual placeholder for now
// — real Supabase auth (shared with dndbnb, so the player's dndbnb characters
// can be pulled into battles) is a later step. "Continue in guest mode" drops
// straight into the current app.

type Mode = 'sign-in' | 'sign-up';

// dndbnb's username rules, shown in sign-up mode (kept in sync with the real
// validation when auth is wired).
const USERNAME_RULES =
  '3-30 characters, lowercase letters, digits, underscore, or dash. Must start with a letter or digit.';

export interface SignInScreen {
  unmount(): void;
}

export const mountSignInScreen = (parent: HTMLElement, onGuest: () => void): SignInScreen => {
  const root = document.createElement('div');
  root.id = 'signin-screen';
  root.innerHTML = `
    <section class="auth-card">
      <h2 class="auth-title">Sign in</h2>
      <p class="form-hint auth-subtitle">Sign in with your dndbnb account to use your characters in battle.</p>
      <form class="auth-form">
        <label>Username
          <input type="text" class="auth-username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" />
        </label>
        <label>Password
          <input type="password" class="auth-password" autocomplete="current-password" />
        </label>
        <p class="form-hint auth-rules" hidden>${USERNAME_RULES}</p>
        <p class="form-hint auth-notice" hidden>Account sign-in is coming soon. For now, continue in guest mode below.</p>
        <button type="submit" class="auth-submit">Sign in</button>
      </form>
      <p class="auth-toggle">
        <span class="auth-toggle-text">New here? </span>
        <button type="button" class="link-button auth-toggle-btn">Create an account</button>
      </p>
    </section>
    <button type="button" class="link-button guest-link">Continue in guest mode</button>
  `;
  parent.appendChild(root);

  const select = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`sign-in-screen: missing ${sel}`);
    return el;
  };
  const title = select('.auth-title');
  const form = select<HTMLFormElement>('.auth-form');
  const password = select<HTMLInputElement>('.auth-password');
  const rules = select('.auth-rules');
  const notice = select('.auth-notice');
  const submit = select('.auth-submit');
  const toggleText = select('.auth-toggle-text');
  const toggleBtn = select('.auth-toggle-btn');
  const guestLink = select('.guest-link');

  let mode: Mode = 'sign-in';
  const applyMode = (): void => {
    const signingIn = mode === 'sign-in';
    title.textContent = signingIn ? 'Sign in' : 'Create an account';
    submit.textContent = signingIn ? 'Sign in' : 'Sign up';
    toggleText.textContent = signingIn ? 'New here? ' : 'Already have an account? ';
    toggleBtn.textContent = signingIn ? 'Create an account' : 'Sign in';
    password.autocomplete = signingIn ? 'current-password' : 'new-password';
    rules.hidden = signingIn;
    notice.hidden = true;
  };

  toggleBtn.addEventListener('click', () => {
    mode = mode === 'sign-in' ? 'sign-up' : 'sign-in';
    applyMode();
  });
  // Placeholder: real auth isn't wired yet, so submitting just surfaces the
  // "coming soon" note rather than reaching a backend.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    notice.hidden = false;
  });
  guestLink.addEventListener('click', onGuest);

  applyMode();

  return {
    unmount() {
      root.remove();
    },
  };
};
