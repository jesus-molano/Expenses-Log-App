"use client";

import { Pencil, Plus, Tags, Trash2, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { IconButton } from "@/components/ui/IconButton";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { Sheet } from "@/components/ui/Sheet";
import {
  buildCategoryOptions,
  categoryUsage,
  type CategoryInput,
} from "@/domain/categories";
import type { AppLanguage, ExpenseCategory, ExpenseStore } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { formatMessage, t } from "@/shared/i18n";
import { useCategoryManager } from "../../hooks/use-category-manager";
import { categoryToneClass } from "../../lib/expense-actions";
import { categoryUsageLabel } from "../../lib/expense-detail-labels";
import { categoryIconMap } from "../../lib/expense-form-options";
import { CategoryEditorFields } from "./CategoryEditorFields";

type CategoryManagerSheetProps = {
  store: ExpenseStore;
  language: AppLanguage;
  onClose: () => void;
  onCreate: (input: CategoryInput) => string | null;
  onUpdate: (categoryId: string, input: CategoryInput) => void;
  onDelete: (categoryId: string, replacementName: string) => void;
};

// Crear, renombrar, cambiar el color o borrar categorías. Al borrar una que
// usan gastos se elige a cuál pasan.
export function CategoryManagerSheet({
  store,
  language,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: CategoryManagerSheetProps) {
  const categories = store.categories;
  const manager = useCategoryManager({ categories, language, onCreate, onUpdate, onDelete });
  // Las guardadas, en el mismo orden que el selector del formulario.
  const stored = buildCategoryOptions(categories)
    .map((option) => categories.find((category) => category.id === option.id))
    .filter((category): category is ExpenseCategory => Boolean(category));

  return (
    <Sheet
      ariaLabel={t("categoryManager.title", language)}
      onBackdropClick={onClose}
      contentClassName="max-h-[88dvh] sm:max-w-lg"
    >
      <section className="grid gap-4 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-semibold leading-tight text-[var(--app-text)]">
              <Tags size={20} className="text-[var(--app-accent)]" aria-hidden="true" />
              {t("categoryManager.title", language)}
            </h2>
            <p className="mt-1 text-sm font-medium text-[var(--app-text-muted)]">
              {t("categoryManager.subtitle", language)}
            </p>
          </div>
          <IconButton
            type="button"
            onClick={onClose}
            aria-label={t("expenses.close", language)}
            className="shrink-0"
          >
            <X size={18} />
          </IconButton>
        </header>

        {manager.mode.kind === "create" ? (
          <div className="app-inline-panel p-3">
            <CategoryEditorFields
              value={manager.draft}
              error={manager.error}
              submitLabel={t("categoryManager.create", language)}
              language={language}
              onChange={manager.setDraft}
              onSubmit={manager.submit}
              onCancel={manager.cancel}
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            leadingIcon={<Plus size={17} />}
            onClick={manager.startCreate}
          >
            {t("categoryManager.newCategory", language)}
          </Button>
        )}

        {stored.length ? (
          <ul className="grid gap-2">
            {stored.map((category) => (
              <CategoryManagerRow
                key={category.id}
                category={category}
                store={store}
                language={language}
                manager={manager}
              />
            ))}
          </ul>
        ) : (
          <p className="app-empty-line p-5 text-sm font-medium">
            {t("categoryManager.empty", language)}
          </p>
        )}
      </section>
      <DeleteCategoryDialog categories={categories} language={language} manager={manager} />
    </Sheet>
  );
}

// Confirmación común (foco en Cancelar, Escape y Atrás) antes de borrar.
function DeleteCategoryDialog({
  categories,
  language,
  manager,
}: {
  categories: ExpenseCategory[];
  language: AppLanguage;
  manager: ReturnType<typeof useCategoryManager>;
}) {
  const { mode } = manager;
  if (mode.kind !== "delete" || !mode.confirming) return null;
  const category = categories.find((candidate) => candidate.id === mode.categoryId);
  if (!category) return null;
  const label = categoryLabel(category.name, language);

  return (
    <ConfirmActionDialog
      icon={<Trash2 size={18} />}
      title={formatMessage("categoryManager.deleteConfirmTitle", { name: label }, language)}
      body={
        mode.inUse
          ? formatMessage(
              "categoryManager.deleteConfirmBody",
              { target: categoryLabel(manager.replacementName, language) },
              language,
            )
          : t("categoryManager.deleteConfirmBodyUnused", language)
      }
      cancelLabel={t("categoryManager.cancel", language)}
      confirmLabel={t("categoryManager.deleteConfirm", language)}
      onCancel={manager.cancelDelete}
      onConfirm={manager.confirmDelete}
    />
  );
}

function CategoryManagerRow({
  category,
  store,
  language,
  manager,
}: {
  category: ExpenseCategory;
  store: ExpenseStore;
  language: AppLanguage;
  manager: ReturnType<typeof useCategoryManager>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = categoryIconMap[category.icon] ?? WalletCards;
  const label = categoryLabel(category.name, language);
  const usage = categoryUsage(store, category.id);
  const { mode } = manager;

  if (mode.kind === "edit" && mode.categoryId === category.id) {
    return (
      <li className="app-inline-panel p-3">
        <CategoryEditorFields
          value={manager.draft}
          error={manager.error}
          submitLabel={t("categoryManager.save", language)}
          language={language}
          onChange={manager.setDraft}
          onSubmit={manager.submit}
          onCancel={manager.cancel}
        />
      </li>
    );
  }

  if (mode.kind === "delete" && mode.inUse && mode.categoryId === category.id) {
    const replacements = buildCategoryOptions(store.categories).filter(
      (option) => option.id !== category.id,
    );
    return (
      <li className="app-inline-panel grid gap-3 border-[color-mix(in_srgb,var(--app-danger)_28%,transparent)] p-3">
        <p className="text-sm font-semibold text-[var(--app-text)]">
          {t("categoryManager.deleteTitle", language).replace("{name}", label)}
        </p>
        <p className="text-xs text-[var(--app-text-muted)]">
          {usage.templates === 0
            ? t("categoryManager.deleteUnused", language)
            : usage.templates === 1
              ? t("categoryManager.deleteUsageOne", language)
              : t("categoryManager.deleteUsage", language).replace(
                  "{count}",
                  String(usage.templates),
                )}
        </p>
        {usage.templates > 0 || usage.occurrences > 0 ? (
          <SelectMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            value={manager.replacementName}
            label={`${t("categoryManager.moveTo", language)}: ${categoryLabel(manager.replacementName, language)}`}
            options={replacements.map((option) => ({
              value: option.name,
              label: categoryLabel(option.name, language),
            }))}
            onChange={manager.setReplacementName}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" onClick={manager.cancel}>
            {t("categoryManager.cancel", language)}
          </Button>
          <Button type="button" variant="danger" onClick={manager.requestDelete}>
            {t("categoryManager.deleteConfirm", language)}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="app-list-item grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
      <span className={`${categoryToneClass(category.tone)} grid size-9 place-items-center rounded-full`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block break-words text-sm font-semibold leading-snug text-[var(--app-text)]">{label}</span>
        <span className="block break-words text-xs font-medium text-[var(--app-text-muted)]">
          {categoryUsageLabel(usage.templates, language)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <IconButton
          type="button"
          variant="ghost"
          onClick={() => manager.startEdit(category)}
          aria-label={t("categoryManager.edit", language).replace("{name}", label)}
        >
          <Pencil size={16} />
        </IconButton>
        <IconButton
          type="button"
          variant="danger"
          onClick={() =>
            manager.startDelete(category, usage.templates > 0 || usage.occurrences > 0)
          }
          aria-label={t("categoryManager.delete", language).replace("{name}", label)}
        >
          <Trash2 size={16} />
        </IconButton>
      </span>
    </li>
  );
}
