// The logins on this account (Settings → Account → Signed-in devices). Each one is
// a Supabase session; db/supabase.sql's functions read and end them, only ever the
// caller's own. Logging out of every device needs none of this — that's Supabase's
// own signOut({ scope: "global" }).
import { createClient } from "@/lib/supabase/client";

export interface Device {
  id: string; // the session
  name: string; // what it calls itself, or what its user agent says; "" when neither tells
  platform: string; // "web", "android", or "" for a login that hasn't named itself yet
  signedInAt: string;
  lastSeen: string;
  current: boolean; // this browser
}

interface Row {
  session_id: string;
  name: string;
  platform: string;
  user_agent: string;
  signed_in_at: string;
  last_seen: string;
  is_current: boolean;
}

/** The browser and system a user agent describes: "Chrome · Windows"; "" for neither. */
export function browserName(ua: string): string {
  const browser = /\bEdg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /\bOPR\/|\bOpera\b/.test(ua)
      ? "Opera"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /\b(Firefox|FxiOS)\//.test(ua)
          ? "Firefox"
          : /\b(Chrome|CriOS)\//.test(ua)
            ? "Chrome"
            : /\bSafari\//.test(ua)
              ? "Safari"
              : "";
  const system = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone/.test(ua)
        ? "iPhone"
        : /iPad/.test(ua)
          ? "iPad"
          : /Macintosh|Mac OS X/.test(ua)
            ? "Mac"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "";
  // Only a browser's user agent names one; a server's or an app's (node, Dart) doesn't.
  return browser ? [browser, system].filter(Boolean).join(" · ") : "";
}

/** A login that never named itself, by the user agent Supabase saw: an older Android
 *  app says Dart, a browser says what it is, and a server's refresh says nothing. */
const fromAgent = (ua: string) => (ua.startsWith("Dart/") ? { name: "", platform: "android" } : { name: browserName(ua), platform: "" });

const toDevice = (r: Row): Device => {
  const seen = r.name ? null : fromAgent(r.user_agent);
  return {
    id: r.session_id,
    name: r.name || seen?.name || "",
    platform: r.platform || seen?.platform || "",
    signedInAt: r.signed_in_at,
    lastSeen: r.last_seen,
    current: r.is_current,
  };
};

export async function listDevices(): Promise<Device[]> {
  const { data, error } = await createClient().rpc("my_devices");
  if (error) throw error;
  return (data as Row[]).map(toDevice);
}

/** This browser says what it is, and that it's open now. */
export async function touchDevice(): Promise<void> {
  const { error } = await createClient().rpc("touch_device", { device_name: browserName(navigator.userAgent), device_platform: "web" });
  if (error) throw error;
}

/** Signs that login out. Its device notices at its next look (components/system/session-watch). */
export async function removeDevice(id: string): Promise<void> {
  const { error } = await createClient().rpc("remove_device", { target: id });
  if (error) throw error;
}
