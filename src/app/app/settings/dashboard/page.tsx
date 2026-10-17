"use client";

import { SettingsPage } from "@/components/settings/settings-page";
import { DashboardSections } from "@/components/settings/sections";
import { tr } from "@/lib/i18n";

export default function DashboardSettingsPage() {
  return (
    <SettingsPage title={tr("Dashboard")}>
      <DashboardSections />
    </SettingsPage>
  );
}
