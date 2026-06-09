// Entry-gate sign-in screen, styled after dndbnb's account screen (username +
// password, sign-in / sign-up toggle). Authenticates against the same Supabase
// project dndbnb uses, so the player signs in with their dndbnb account (a
// later step pulls their dndbnb characters into battles). "Continue in guest
// mode" drops straight into the current app without an account.

import { supabase } from '@/auth/supabase';
import { errorMessage } from '@/auth/errors';
import {
  USERNAME_RULES,
  PASSWORD_MIN_LEN,
  normalizeUsername,
  usernameToEmail,
  validateUsername,
} from '@/auth/username';

type Mode = 'sign-in' | 'sign-up';

export interface SignInScreen {
  unmount(): void;
}

export interface SignInCallbacks {
  readonly onAuthed: () => void;
  readonly onGuest: () => void;
}

export const mountSignInScreen = (parent: HTMLElement, callbacks: SignInCallbacks): SignInScreen => {
  const root = document.createElement('div');
  root.id = 'signin-screen';
  root.innerHTML = `
    <section class="auth-card">
      <h2 class="auth-title">Sign in</h2>
      <p class="form-hint auth-subtitle">Sign in with your dndbnb account to use your characters in battle.</p>
      <form class="auth-form">
        <label>Username
          <input type="text" class="auth-username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required />
        </label>
        <label>Password
          <input type="password" class="auth-password" autocomplete="current-password" minlength="${PASSWORD_MIN_LEN}" required />
        </label>
        <p class="form-hint auth-rules" hidden>${USERNAME_RULES}</p>
        <p class="form-error auth-error" hidden></p>
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
  const usernameInput = select<HTMLInputElement>('.auth-username');
  const passwordInput = select<HTMLInputElement>('.auth-password');
  const rules = select('.auth-rules');
  const error = select('.auth-error');
  const submit = select<HTMLButtonElement>('.auth-submit');
  const toggleText = select('.auth-toggle-text');
  const toggleBtn = select('.auth-toggle-btn');
  const guestLink = select('.guest-link');

  let mode: Mode = 'sign-in';
  let pending = false;

  const showError = (message: string | null): void => {
    error.textContent = message ?? '';
    error.hidden = message === null;
  };

  const setPending = (value: boolean): void => {
    pending = value;
    submit.disabled = value;
    submit.textContent = value ? 'Working...' : mode === 'sign-in' ? 'Sign in' : 'Sign up';
  };

  const applyMode = (): void => {
    const signingIn = mode === 'sign-in';
    title.textContent = signingIn ? 'Sign in' : 'Create an account';
    submit.textContent = signingIn ? 'Sign in' : 'Sign up';
    toggleText.textContent = signingIn ? 'New here? ' : 'Already have an account? ';
    toggleBtn.textContent = signingIn ? 'Create an account' : 'Sign in';
    passwordInput.autocomplete = signingIn ? 'current-password' : 'new-password';
    rules.hidden = signingIn;
    showError(null);
  };

  toggleBtn.addEventListener('click', () => {
    if (pending) return;
    mode = mode === 'sign-in' ? 'sign-up' : 'sign-in';
    applyMode();
  });

  // Authenticate against the shared dndbnb Supabase project. On success the
  // auth-state change unmounts this screen (handled by the caller); on failure
  // we surface a humanized reason.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (pending) return;
    const username = normalizeUsername(usernameInput.value);
    const validationError = validateUsername(username);
    if (validationError) {
      showError(validationError);
      return;
    }
    showError(null);
    setPending(true);
    const email = usernameToEmail(username);
    const password = passwordInput.value;
    const request =
      mode === 'sign-in'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    void request
      .then(({ data, error: authError }) => {
        if (authError) {
          showError(humanizeAuthError(authError));
        } else if (data.session) {
          callbacks.onAuthed();
        } else {
          // signUp returns no session only when email confirmation is on;
          // dndbnb's project has it off (synthetic emails can't confirm), so
          // this is just a safety net.
          showError('Account created. Sign in to continue.');
        }
      })
      .catch((err: unknown) => showError(humanizeAuthError(err)))
      .finally(() => setPending(false));
  });

  guestLink.addEventListener('click', callbacks.onGuest);

  applyMode();

  return {
    unmount() {
      root.remove();
    },
  };
};

// Supabase auth errors leak the synthetic `@dndbnb.invalid` email; strip it and
// rephrase the common cases so the player never sees the internal email format.
const humanizeAuthError = (err: unknown): string => {
  const cleaned = errorMessage(err).replace(/@dndbnb\.invalid/g, '');
  if (/invalid login credentials/i.test(cleaned)) return 'Invalid username or password.';
  if (/already registered/i.test(cleaned) || /already.*exists/i.test(cleaned)) return 'That username is taken.';
  return cleaned;
};
