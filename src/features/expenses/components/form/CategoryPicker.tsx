"use client";

import { WalletCards } from "lucide-react";
import { PRESET_EXPENSE_CATEGORIES } from "@/domain/categories";
import type { AppLanguage } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";
import { categoryToneClass } from "../../lib/expense-actions";
import { categoryIconMap } from "../../lib/expense-form-options";

type CategoryPickerProps = {
  value: string;
  onChange: (categoryName: string) => void;
  language?: AppLanguage;
};

export function CategoryPicker({
  value,
  onChange,
  language = "es",
}: CategoryPickerProps) {
  return (
    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-3">
      <p className="mb-2 text-sm font-semibold text-white">
        {t("expenses.category", language)}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PRESET_EXPENSE_CATEGORIES.map((category) => {
          const Icon = categoryIconMap[category.icon] ?? WalletCards;
          const selected = category.name.toLowerCase() === value.toLowerCase();

          return (
            <button
              key={category.name}
              type="button"
              onClick={() => onChange(category.name)}
              aria-pressed={selected}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold transition ${
                selected
                  ? "bg-lime-300 text-slate-950 shadow-[0_0_24px_rgba(190,242,100,0.22)]"
                  : `${categoryToneClass(category.tone)} bg-opacity-70`
              }`}
            >
              <Icon size={16} />
              <span className="truncate">
                {categoryLabel(category.name, language)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
