// Username utilities, ported from dndbnb (its lib/username.ts) so dnd-web logs
// in against the same accounts. dndbnb is username-only: no real email is
// collected. Supabase Auth is email-based, so each username maps to a
// non-routable `<username>@dndbnb.invalid` address (RFC 2606 reserved TLD).
// Keep in sync with dndbnb's rules so a username resolves to the same account.

export const USERNAME_DOMAIN = 'dndbnb.invalid';

const USERNAME_MIN_LEN = 3;
const USERNAME_MAX_LEN = 30;
// Lowercase letters, digits, underscore, dash. Must start with a letter or
// digit so usernames don't look like flags or render invisible.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export const USERNAME_RULES = `${USERNAME_MIN_LEN}-${USERNAME_MAX_LEN} characters, lowercase letters, digits, underscore, or dash. Must start with a letter or digit.`;

export const PASSWORD_MIN_LEN = 8;

export const normalizeUsername = (raw: string): string => raw.trim().toLowerCase();

export const validateUsername = (username: string): string | null => {
  if (username.length < USERNAME_MIN_LEN) return `Username must be at least ${USERNAME_MIN_LEN} characters.`;
  if (username.length > USERNAME_MAX_LEN) return `Username must be at most ${USERNAME_MAX_LEN} characters.`;
  if (!USERNAME_PATTERN.test(username)) return USERNAME_RULES;
  return null;
};

export const usernameToEmail = (username: string): string =>
  `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;

export const emailToUsername = (email: string | null | undefined): string | null => {
  if (!email) return null;
  const suffix = `@${USERNAME_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : null;
};
