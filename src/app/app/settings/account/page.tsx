"use client";

import { SettingsPage } from "@/components/settings/settings-page";
import { AccountSection } from "@/components/settings/sections";
import { tr } from "@/lib/i18n";

export default function AccountSettingsPage() {
  return (
    <SettingsPage title={tr("Account")}>
      <AccountSection />
    </SettingsPage>
  );
}
