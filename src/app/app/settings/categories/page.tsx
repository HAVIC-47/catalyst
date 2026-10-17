"use client";

import { SettingsPage } from "@/components/settings/settings-page";
import { CategorySection } from "@/components/settings/sections";
import { useAppData } from "@/hooks/use-app-data";
import { tr } from "@/lib/i18n";

export default function CategoriesSettingsPage() {
  const { categories } = useAppData();
  return (
    <SettingsPage title={tr("Categories")} wide>
      <p className="mb-5 max-w-lg text-sm text-ink/45">
        {tr("Add, rename, recolor, or remove categories for expenses and income. Deleting one keeps past transactions labeled.")}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <CategorySection kind="expense" />
        <CategorySection kind="income" />
      </div>
      {categories.length === 0 && <p className="mt-4 font-mono text-xs text-ink/30">{tr("Loading categories…")}</p>}
    </SettingsPage>
  );
}
