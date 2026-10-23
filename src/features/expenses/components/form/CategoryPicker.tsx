import { WalletCards } from "lucide-react";
import { Fragment } from "react";
import { Surface } from "@/components/ui/Surface";
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

// "Educacion/Trabajo" no tiene hueco donde saltar de linea y se partia a
// mitad de palabra ("Educacion/Tra" + "bajo"). <wbr> tras cada barra deja que
// salte justo despues de ella sin cambiar el texto ni el nombre accesible.
function SlashBreakableText({ text }: { text: string }) {
  return text.split("/").map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? "/" : null}
      {index > 0 ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}

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
              className={`app-control app-category-picker-option inline-flex min-h-10 items-center justify-center gap-1.5 px-2 text-xs font-bold ${
                selected ? "" : categoryToneClass(category.tone)
              }`}
              data-selected={selected ? "true" : "false"}
            >
              <Icon size={14} />
              {/* Nombre completo de la categoria (el mismo que en las filas):
                  si no cabe, salta de linea y el boton crece en alto. */}
              <span className="min-w-0 break-words text-center leading-tight">
                <SlashBreakableText text={label} />
              </span>
            </button>
          );
        })}
      </div>
    </Surface>
  );
}
