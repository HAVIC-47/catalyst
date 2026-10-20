// "Remember me" on the login page. Supabase keeps the session in cookies that last
// 400 days; with Remember me off, the browser client, the server client and the
// proxy write them without a lifetime instead, so the browser drops them when it
// closes. The choice itself is a cookie of the same kind (cat-remember=0), so it
// goes when the session does.
export const REMEMBER_COOKIE = "cat-remember";

/** False when the cookie string (or a cookie value) says "don't remember me". */
export function remembered(cookieOrValue: string | undefined | null): boolean {
  if (!cookieOrValue) return true;
  if (cookieOrValue === "0") return false;
  return !new RegExp(`(?:^|;\\s*)${REMEMBER_COOKIE}=0(?:;|$)`).test(cookieOrValue);
}

/** A cookie's options as this session wants them: unchanged when remembered;
 *  otherwise without a lifetime (a removal — max-age 0 — stays a removal). */
export function withLifetime<T extends { maxAge?: number; expires?: Date }>(options: T, remember: boolean): T {
  if (remember || !options || !(Number(options.maxAge) > 0)) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}

/** Set by the login page right before signing in. */
export function setRemember(on: boolean) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = on
    ? `${REMEMBER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    : `${REMEMBER_COOKIE}=0; Path=/; SameSite=Lax${secure}`;
}
