"use client";

import { SettingsPage } from "@/components/settings/settings-page";
import { NotificationsSection } from "@/components/settings/sections";
import { tr } from "@/lib/i18n";

export default function NotificationsSettingsPage() {
  return (
    <SettingsPage title={tr("Notifications")}>
      <NotificationsSection />
    </SettingsPage>
  );
}
