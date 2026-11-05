"use client";

// Settings → Account: everywhere this account is signed in. Remove any one of them,
// or sign out of all of them.
import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut, Monitor, Smartphone, X } from "lucide-react";
import { listDevices, removeDevice, touchDevice, type Device } from "@/lib/db/devices";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/utils";
import { tr } from "@/lib/i18n";

const onPhone = (d: Device) => d.platform === "android" || /Android|iPhone|iPad/.test(d.name);

/** What a login is called, when it never said (it signed in before this list existed). */
const deviceName = (d: Device) => d.name || (d.platform === "android" ? tr("Android phone") : tr("Unknown device"));

export function Devices() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // the device being removed, or "all"
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setProblem("");
    try {
      // Named first, so this browser's row never shows as unknown (a password change starts a new login).
      await touchDevice();
      setDevices(await listDevices());
    } catch (err) {
      console.warn("[catalyst] could not list devices", err);
      const message = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "";
      setProblem(/my_devices|touch_device|schema cache|does not exist/i.test(message) ? tr("This list needs the database update — run db/supabase.sql.") : tr("Couldn't load your devices."));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (d: Device) => {
    const name = deviceName(d);
    if (busy || !window.confirm(tr("Sign out of {name}? It will have to log in again.", { name }))) return;
    setBusy(d.id);
    setError("");
    try {
      await removeDevice(d.id);
      setDevices((p) => p?.filter((x) => x.id !== d.id) ?? null);
    } catch (err) {
      console.warn("[catalyst] could not remove a device", err);
      setError(tr("Couldn't remove {name} — try again.", { name }));
    } finally {
      setBusy(null);
    }
  };

  /** Signing out of this browser, or of all of them, ends with a fresh start on the landing page. */
  const leave = async (scope: "local" | "global") => {
    if (busy) return;
    if (scope === "global" && !window.confirm(tr("Sign out of all devices, including this one?"))) return;
    setBusy(scope === "global" ? "all" : "here");
    setError("");
    const { error: failed } = await createClient().auth.signOut({ scope });
    if (failed) {
      setError(tr("Couldn't sign out — check your connection and try again."));
      setBusy(null);
      return;
    }
    window.location.assign("/");
  };

  return (
    <div className="mt-5 rounded-xl border border-line p-4">
      <div className="text-sm text-ink/75">
        {tr("Signed-in devices")}
        <span className="block text-[11px] text-ink/45">
          {tr("Everywhere your account is signed in. If you don't recognise one, remove it and change your password.")}
        </span>
      </div>

      {problem ? (
        <p className="mt-3 text-xs text-ink/55">
          {problem}{" "}
          <button type="button" onClick={() => void load()} className="cursor-pointer text-amber hover:underline">
            {tr("Try again")}
          </button>
        </p>
      ) : devices === null ? (
        <p className="mt-3 font-mono text-xs text-ink/35">{tr("Loading…")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {devices.map((d) => {
            const Icon = onPhone(d) ? Smartphone : Monitor;
            return (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-ink/45" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-sm text-ink/85">
                    <span className="min-w-0 truncate">{deviceName(d)}</span>
                    {d.current && (
                      <span className="shrink-0 rounded-full bg-amber/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber">{tr("This device")}</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-ink/45">
                    {d.current ? tr("Active now") : tr("Last active {date}", { date: fmt(new Date(d.lastSeen), "MMM d, h:mm a") })}
                    {" · "}
                    {tr("Signed in {date}", { date: fmt(new Date(d.signedInAt), "MMM d, yyyy") })}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void (d.current ? leave("local") : remove(d))}
                  disabled={!!busy}
                  className="inline-flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium text-ink/70 transition-colors hover:border-expense/40 hover:text-expense disabled:cursor-default disabled:opacity-50"
                >
                  {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : d.current ? <LogOut className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                  {d.current ? tr("Sign out") : tr("Remove")}
                  {!d.current && <span className="sr-only">{deviceName(d)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="mt-2 text-xs text-expense" role="alert">
          {error}
        </p>
      )}

      {/* Supabase's own: it works whatever the list can show. */}
      <button
        type="button"
        onClick={() => void leave("global")}
        disabled={!!busy}
        className="mt-3 inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-ink/75 transition-colors hover:border-expense/40 hover:text-expense disabled:cursor-default disabled:opacity-50"
      >
        {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
        {tr("Sign out of all devices")}
      </button>
    </div>
  );
}
