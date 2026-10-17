"use client";

// Settings: a short list, each row leading to its own page — language and
// currency, reminders, dashboard sections, categories, About the app, account.
// Each row says how it's set right now.
import { useEffect, useState } from "react";
import { BellRing, Info, Languages, LayoutGrid, Tags, UserRound } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { DASHBOARD_SECTIONS } from "@/lib/dashboard-sections";
import { currencyOf } from "@/lib/currency";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { SettingsCard, SettingsRow } from "@/components/settings/settings-page";

export default function SettingsPage() {
  const { lang, currency, reminders, dashboardHidden, categories } = useAppData();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const cur = currencyOf(currency);
  const on = [reminders.checkin, reminders.bills, reminders.budgets, reminders.dhar].filter(Boolean).length;
  const [h, m] = reminders.checkinTime.split(":").map(Number);
  const hidden = dashboardHidden ?? [];
  const shown = DASHBOARD_SECTIONS.filter((s) => !hidden.includes(s.id)).length;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <div className="label mb-2">{tr("Settings")}</div>
          <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            {tr("Make it")}{" "}<span className="serif-italic text-amber/90">{tr("yours.")}</span>
          </h1>
        </div>

        <SettingsCard>
          <SettingsRow
            href="/app/settings/language"
            icon={Languages}
            title={tr("Language & currency")}
            hint={`${lang === "bn" ? "বাংলা" : "English"} · ${cur.symbol.trim()} ${tr(cur.name)}`}
          />
          <SettingsRow
            href="/app/settings/reminders"
            icon={BellRing}
            title={tr("Reminders")}
            hint={
              on === 0
                ? tr("All off")
                : tr("{n} of 4 on · check-in at {time}", { n: on, time: fmt(new Date(2000, 0, 1, h || 0, m || 0), "h:mm a") })
            }
          />
          <SettingsRow
            href="/app/settings/dashboard"
            icon={LayoutGrid}
            title={tr("Dashboard")}
            hint={tr("{n} of {total} sections shown", { n: shown, total: DASHBOARD_SECTIONS.length })}
          />
          <SettingsRow
            href="/app/settings/categories"
            icon={Tags}
            title={tr("Categories")}
            hint={tr("{expense} expense · {income} income", {
              expense: categories.filter((c) => c.kind === "expense").length,
              income: categories.filter((c) => c.kind === "income").length,
            })}
          />
        </SettingsCard>

        <div className="mt-5">
          <SettingsCard>
            <SettingsRow href="/app/settings/about" icon={Info} title={tr("About the app")} hint={tr("Everything Catalyst does on the web, in one place.")} />
            <SettingsRow href="/app/settings/account" icon={UserRound} title={tr("Account")} hint={email ?? tr("Your email and deleting the account")} />
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
