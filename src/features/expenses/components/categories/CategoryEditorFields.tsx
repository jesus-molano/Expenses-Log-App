import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { CATEGORY_NAME_MAX_LENGTH, type CategoryInput } from "@/domain/categories";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { CategoryToneSwatches } from "./CategoryToneSwatches";

type CategoryEditorFieldsProps = {
  value: CategoryInput;
  error: string | null;
  submitLabel: string;
  language: AppLanguage;
  onChange: (value: CategoryInput) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

// Nombre y color de una categoría. No es un <form>: vive dentro del
// formulario del gasto, así que Intro se intercepta para no guardar el gasto.
export function CategoryEditorFields({
  value,
  error,
  submitLabel,
  language,
  onChange,
  onSubmit,
  onCancel,
}: CategoryEditorFieldsProps) {
  const inputId = useId();
  const errorId = useId();

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor={inputId} className="text-sm font-semibold text-[var(--app-text-muted)]">
          {t("categoryManager.name", language)}
        </label>
        <input
          id={inputId}
          value={value.name}
          maxLength={CATEGORY_NAME_MAX_LENGTH}
          autoComplete="off"
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSubmit();
            }
            if (event.key === "Escape") {
              // Cierra solo el editor, no la hoja que lo contiene.
              event.preventDefault();
              event.stopPropagation();
              event.nativeEvent.stopImmediatePropagation();
              onCancel();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="input-control"
          placeholder={t("categoryManager.namePlaceholder", language)}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-xs font-semibold text-[var(--app-danger)]">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <p className="text-sm font-semibold text-[var(--app-text-muted)]">
          {t("categoryManager.color", language)}
        </p>
        <CategoryToneSwatches
          value={value.tone}
          language={language}
          onChange={(tone) => onChange({ ...value, tone })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("categoryManager.cancel", language)}
        </Button>
        <Button type="button" variant="primary" onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
