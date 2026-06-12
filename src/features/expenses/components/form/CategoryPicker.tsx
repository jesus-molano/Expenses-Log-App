"use client";

import { WalletCards } from "lucide-react";
import { Surface } from "@/components/ui/Surface";
import { PRESET_EXPENSE_CATEGORIES } from "@/domain/categories";
import type { AppLanguage } from "@/domain/types";
import { categoryLabel, compactCategoryLabel } from "@/shared/category-labels";
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
    <Surface variant="section" padding="sm">
      <p className="mb-2 text-sm font-semibold text-[var(--app-text)]">
        {t("expenses.category", language)}
      </p>
      <div className="grid grid-cols-2 gap-1.5 min-[430px]:grid-cols-3">
        {PRESET_EXPENSE_CATEGORIES.map((category) => {
          const Icon = categoryIconMap[category.icon] ?? WalletCards;
          const selected = category.name.toLowerCase() === value.toLowerCase();
          const label = categoryLabel(category.name, language);

          return (
            <button
              key={category.name}
              type="button"
              onClick={() => onChange(category.name)}
              aria-pressed={selected}
              aria-label={label}
              title={label}
              className={`app-control app-category-picker-option inline-flex min-h-10 items-center justify-center gap-1.5 px-2 text-xs font-bold ${
                selected ? "" : categoryToneClass(category.tone)
              }`}
              data-selected={selected ? "true" : "false"}
            >
              <Icon size={14} />
              <span className="min-w-0 truncate">
                {compactCategoryLabel(category.name, language)}
              </span>
            </button>
          );
        })}
      </div>
    </Surface>
  );
}
