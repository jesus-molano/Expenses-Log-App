import { Plus, WalletCards } from "lucide-react";
import { Fragment, useState } from "react";
import { Surface } from "@/components/ui/Surface";
import {
  buildCategoryOptions,
  validateCategoryName,
  type CategoryInput,
} from "@/domain/categories";
import { foldText } from "@/domain/text";
import type { AppLanguage, ExpenseCategory } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";
import { categoryToneClass } from "../../lib/expense-actions";
import { categoryNameErrorLabel } from "../../lib/expense-detail-labels";
import { categoryIconMap } from "../../lib/expense-form-options";
import { CategoryEditorFields } from "../categories/CategoryEditorFields";

type CategoryPickerProps = {
  value: string;
  onChange: (categoryName: string) => void;
  language?: AppLanguage;
  // Categorías guardadas: aportan las propias y el color elegido.
  categories?: ExpenseCategory[];
  // Crea una categoría propia y devuelve su id (null si no es válida).
  onCreateCategory?: (input: CategoryInput) => string | null;
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
  categories = [],
  onCreateCategory,
}: CategoryPickerProps) {
  const options = buildCategoryOptions(categories);
  const [draft, setDraft] = useState<CategoryInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  function create() {
    if (!draft || !onCreateCategory) return;
    const existing = categories.find(
      (category) => foldText(category.name) === foldText(draft.name),
    );
    // Si ya existe con ese nombre, se elige esa en lugar de duplicarla.
    if (existing) {
      onChange(existing.name);
      setDraft(null);
      return;
    }
    const nameError = validateCategoryName(categories, draft.name);
    if (nameError) {
      setError(categoryNameErrorLabel(nameError, language));
      return;
    }
    if (onCreateCategory(draft)) {
      onChange(draft.name.trim());
      setDraft(null);
      setError(null);
    }
  }

  return (
    <Surface variant="section" padding="sm">
      <p className="mb-2 text-sm font-semibold text-[var(--app-text)]">
        {t("expenses.category", language)}
      </p>
      <div className="grid grid-cols-2 gap-1.5 min-[430px]:grid-cols-3">
        {options.map((category) => {
          const Icon = categoryIconMap[category.icon] ?? WalletCards;
          const selected = foldText(category.name) === foldText(value);
          const label = categoryLabel(category.name, language);

          return (
            <button
              key={category.id ?? category.name}
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
        {onCreateCategory ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setDraft(draft ? null : { name: "", tone: "violet" });
            }}
            aria-expanded={draft !== null}
            className="app-control col-span-full inline-flex min-h-10 items-center justify-center gap-1.5 px-2 text-xs font-bold"
          >
            <Plus size={14} />
            <span className="min-w-0 break-words">{t("categoryManager.newCategory", language)}</span>
          </button>
        ) : null}
      </div>

      {draft ? (
        <div className="app-inline-panel mt-3 p-3">
          <CategoryEditorFields
            value={draft}
            error={error}
            submitLabel={t("categoryManager.create", language)}
            language={language}
            onChange={(next) => {
              setDraft(next);
              setError(null);
            }}
            onSubmit={create}
            onCancel={() => {
              setDraft(null);
              setError(null);
            }}
          />
        </div>
      ) : null}
    </Surface>
  );
}
