"use client";

// Keeps this browser's login honest. Every couple of minutes while the tab is in
// view (and whenever it comes back) it asks Supabase whether the login still exists:
// once it's gone — removed from another device's Settings → Account, or signed out in
// another tab — it goes to the login page and says so. (Which of those it was can't be
// told from here: the proxy may have cleared the cookies already.) A lost connection
// is not a sign-out. It also tells the Signed-in devices list that this browser is
// here and what it's called. Renders nothing.
import { useEffect } from "react";
import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { touchDevice } from "@/lib/db/devices";
import { createClient } from "@/lib/supabase/client";

const CHECK_MS = 2 * 60 * 1000;
const TOUCH_MS = 10 * 60 * 1000;

export function SessionWatch() {
  useEffect(() => {
    let lastTouch = 0;
    let gone = false;

    const check = async () => {
      if (gone || document.visibilityState !== "visible") return;
      const { error } = await createClient().auth.getUser();
      if (error && (isAuthSessionMissingError(error) || (isAuthApiError(error) && [400, 401, 403].includes(error.status)))) {
        gone = true;
        window.location.assign("/login?from=landing&removed=1");
        return;
      }
      if (error || Date.now() - lastTouch < TOUCH_MS) return;
      lastTouch = Date.now();
      // Before the database update there's no list to be on: nothing to do.
      touchDevice().catch((err) => console.warn("[catalyst] could not update this device", err));
    };

    void check();
    const id = window.setInterval(() => void check(), CHECK_MS);
    const back = () => void check();
    document.addEventListener("visibilitychange", back);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", back);
    };
  }, []);

  return null;
}
