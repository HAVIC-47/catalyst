"use client";

import { SettingsPage } from "@/components/settings/settings-page";
import { RemindersSection } from "@/components/settings/sections";
import { tr } from "@/lib/i18n";

export default function RemindersSettingsPage() {
  return (
    <SettingsPage title={tr("Reminders")}>
      <RemindersSection />
    </SettingsPage>
  );
}
