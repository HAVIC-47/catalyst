"use client";

// Invisible hourly ping to /api/heartbeat. Renders nothing, holds no state that
// anything else reads, and swallows every failure — purely there so the backend
// keeps seeing traffic while a tab is open.
import { useEffect } from "react";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function Heartbeat() {
  useEffect(() => {
    let last = 0;

    const ping = () => {
      last = Date.now();
      fetch("/api/heartbeat", { method: "GET", cache: "no-store", keepalive: true }).catch(
        () => {},
      );
    };

    // Background tabs get their timers throttled or frozen outright, so a tab
    // left open overnight can miss ticks. Re-check on wake and catch up.
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= INTERVAL_MS) ping();
    };

    ping();
    const id = window.setInterval(ping, INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
