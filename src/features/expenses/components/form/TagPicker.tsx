"use client";

import { PRESET_EXPENSE_TAGS } from "@/domain/categories";
import type { AppLanguage } from "@/domain/types";
import { tagLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";

type TagPickerProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  language?: AppLanguage;
};

export function TagPicker({
  value,
  onChange,
  language = "es",
}: TagPickerProps) {
  function toggleTag(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((item) => item !== tag));
      return;
    }

    onChange([...value, tag].slice(0, 8));
  }

  return (
    <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-3">
      <p className="mb-2 text-sm font-semibold text-white">
        {t("expenses.tags", language)}
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESET_EXPENSE_TAGS.map((tag) => {
          const selected = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              aria-pressed={selected}
              className={`h-9 rounded-full px-3 text-sm font-semibold transition ${
                selected
                  ? "bg-cyan-200 text-slate-950 shadow-[0_0_18px_rgba(103,232,249,0.18)]"
                  : "bg-white/[0.055] text-slate-200 ring-1 ring-white/10"
              }`}
            >
              #{tagLabel(tag, language)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
