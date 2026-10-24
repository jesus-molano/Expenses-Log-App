import { Check } from "lucide-react";
import { CATEGORY_TONES } from "@/domain/categories";
import type { AppLanguage, CategoryTone } from "@/domain/types";
import { t } from "@/shared/i18n";
import { cn } from "@/shared/ui";
import { categoryToneClass } from "../../lib/expense-actions";
import { categoryToneLabel } from "../../lib/expense-detail-labels";

type CategoryToneSwatchesProps = {
  value: CategoryTone;
  language: AppLanguage;
  onChange: (tone: CategoryTone) => void;
};

// Los seis colores de categoría del tema, como un grupo de opciones.
export function CategoryToneSwatches({ value, language, onChange }: CategoryToneSwatchesProps) {
  return (
    <div
      role="radiogroup"
      aria-label={t("categoryManager.color", language)}
      className="flex flex-wrap gap-2"
    >
      {CATEGORY_TONES.map((tone) => {
        const selected = tone === value;
        return (
          <button
            key={tone}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={categoryToneLabel(tone, language)}
            title={categoryToneLabel(tone, language)}
            onClick={() => onChange(tone)}
            className={cn(
              categoryToneClass(tone),
              "app-focus-ring grid size-10 place-items-center rounded-full",
              selected && "ring-2 ring-[var(--app-text)]",
            )}
          >
            {selected ? <Check size={16} strokeWidth={3} /> : null}
          </button>
        );
      })}
    </div>
  );
}
