"use client";

import { SettingsPage } from "@/components/settings/settings-page";
import { CategorySection } from "@/components/settings/sections";
import { useAppData } from "@/hooks/use-app-data";
import { tr } from "@/lib/i18n";

export default function IncomeCategoriesPage() {
  const { categories } = useAppData();
  return (
    <SettingsPage title={tr("Income categories")} back="/app/settings/categories" backLabel={tr("Back to Categories")}>
      <CategorySection kind="income" />
      {categories.length === 0 && <p className="mt-4 font-mono text-xs text-ink/30">{tr("Loading categories…")}</p>}
    </SettingsPage>
  );
}
