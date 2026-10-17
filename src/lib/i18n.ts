// Bangla UI. The English text is the key: tr("Wallets") is "ওয়ালেট" when the app is
// in Bangla and bn.ts has it, else the English itself — a missing translation shows
// English, never a blank. {name} slots are filled from args (numbers in the
// language's digits). A word with two meanings carries its sense after a bar
// ("Low|mood", "Low|priority"); English shows the part before it.
//
// The language is an account preference shared with the Android app (user
// metadata "lang"); this browser also remembers it ("lang" in localStorage) so
// the login page and the first paint already use it.
import { bn } from "./bn";

export type Lang = "en" | "bn";

let current: Lang = "en";

export const lang = (): Lang => current;
export const isBangla = (): boolean => current === "bn";

export function asLang(v: unknown): Lang {
  return v === "bn" ? "bn" : "en";
}

/** Switch the language for everything rendered from now on. */
export function setLang(v: unknown): Lang {
  current = asLang(v);
  if (typeof document !== "undefined") document.documentElement.lang = current;
  return current;
}

/** The language this browser used last (before the account's loads). */
export function storedLang(): Lang {
  try {
    return asLang(localStorage.getItem("lang"));
  } catch {
    return "en";
  }
}

export function rememberLang(l: Lang) {
  try {
    localStorage.setItem("lang", l);
  } catch {
    // private mode: the account keeps it anyway
  }
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Bengali digits in Bangla — for showing a number, never for a field's value. */
export function digits(s: string): string {
  return current === "bn" ? s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : s;
}

/** Typed Bengali digits back to 0-9, so an amount parses whichever keyboard typed it. */
export function asciiDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

export function tr(en: string, args?: Record<string, string | number | null | undefined>): string {
  const bar = en.indexOf("|");
  const plain = bar < 0 ? en : en.slice(0, bar);
  let s = current === "bn" ? (bn[en] ?? plain) : plain;
  if (args) {
    for (const [k, v] of Object.entries(args)) s = s.split(`{${k}}`).join(typeof v === "number" ? digits(String(v)) : (v ?? ""));
  }
  return s;
}

/** Singular or plural: trn(n, "{n} payment", "{n} payments"). */
export function trn(n: number, one: string, many: string): string {
  return tr(n === 1 ? one : many, { n });
}
