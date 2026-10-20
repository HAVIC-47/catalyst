"use client";

// Browser-side Supabase client (cookie-based auth via @supabase/ssr). It reads and
// writes the session cookies itself so "Remember me" off can make them session
// cookies (see lib/supabase/remember.ts).
import { createBrowserClient } from "@supabase/ssr";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { remembered, withLifetime } from "@/lib/supabase/remember";

type CookieOptions = { path?: string; domain?: string; sameSite?: boolean | "lax" | "strict" | "none"; secure?: boolean; maxAge?: number; expires?: Date };

function readCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie.split(/;\s*/).flatMap((pair) => {
    const i = pair.indexOf("=");
    if (i < 1) return [];
    const name = pair.slice(0, i);
    const raw = pair.slice(i + 1);
    try {
      return [{ name, value: decodeURIComponent(raw) }];
    } catch {
      return [{ name, value: raw }];
    }
  });
}

function writeCookie(name: string, value: string, options: CookieOptions) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? "/"}`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  const same = options.sameSite === true ? "strict" : options.sameSite || "lax";
  parts.push(`SameSite=${same.charAt(0).toUpperCase()}${same.slice(1)}`);
  if (options.secure) parts.push("Secure");
  document.cookie = parts.join("; ");
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see .env.local.example).",
    );
  }
  return createBrowserClient(url, key, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => readCookies(),
      setAll: (cookies) => {
        const remember = remembered(typeof document === "undefined" ? "" : document.cookie);
        for (const { name, value, options } of cookies) writeCookie(name, value, withLifetime(options as CookieOptions, remember));
      },
    },
  });
}
