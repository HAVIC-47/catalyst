"use client";

// Categories: what they're for, then one page for expense and one for income.
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { SettingsCard, SettingsPage, SettingsRow } from "@/components/settings/settings-page";
import { useAppData } from "@/hooks/use-app-data";
import { tr, trn } from "@/lib/i18n";

export default function CategoriesSettingsPage() {
  const { categories } = useAppData();
  const count = (kind: "expense" | "income") => categories.filter((c) => c.kind === kind).length;
  return (
    <SettingsPage title={tr("Categories")}>
      <p className="mb-5 max-w-lg text-sm text-ink/45">
        {tr("Add, rename, recolor, or remove categories for expenses and income. Deleting one keeps past transactions labeled.")}
      </p>
      <SettingsCard>
        <SettingsRow
          href="/app/settings/categories/expense"
          icon={ArrowUpRight}
          title={tr("Expense categories")}
          hint={trn(count("expense"), "{n} category", "{n} categories")}
        />
        <SettingsRow
          href="/app/settings/categories/income"
          icon={ArrowDownLeft}
          title={tr("Income categories")}
          hint={trn(count("income"), "{n} category", "{n} categories")}
        />
      </SettingsCard>
    </SettingsPage>
  );
}
