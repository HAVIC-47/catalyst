"use client";

import { SettingsPage } from "@/components/settings/settings-page";
import { CurrencySection, LanguageSection } from "@/components/settings/sections";
import { tr } from "@/lib/i18n";

export default function LanguageSettingsPage() {
  return (
    <SettingsPage title={tr("Language & currency")} wide>
      <div className="grid gap-6 lg:grid-cols-2">
        <LanguageSection />
        <CurrencySection />
      </div>
    </SettingsPage>
  );
}
