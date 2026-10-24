"use client";

import { LayoutList, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseCategory } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { t, type TranslationKey } from "@/shared/i18n";
import { useCatalogFilters } from "../../hooks/use-expense-catalog";
import {
  ALL_CATEGORIES,
  type CatalogFrequencyFilter,
  type CatalogItem,
  type CatalogStatusFilter,
} from "../../lib/expense-catalog";
import { CatalogItemCard } from "./CatalogItemCard";

type ExpenseCatalogSheetProps = {
  items: CatalogItem[];
  categories: ExpenseCategory[];
  language: AppLanguage;
  onClose: () => void;
};

const STATUS_OPTIONS: Array<[CatalogStatusFilter, TranslationKey]> = [
  ["active", "catalog.statusActive"],
  ["finished", "catalog.statusFinished"],
  ["all", "catalog.statusAll"],
];

const FREQUENCY_OPTIONS: Array<[CatalogFrequencyFilter, TranslationKey]> = [
  ["all", "catalog.frequencyAll"],
  ["monthly", "catalog.frequencyMonthly"],
  ["quarterly", "catalog.frequencyQuarterly"],
  ["yearly", "catalog.frequencyYearly"],
  ["once", "catalog.frequencyOnce"],
  ["other", "catalog.frequencyOther"],
];

// "Todos": cada serie (activa o terminada) con búsqueda y filtros por estado,
// frecuencia y categoría. Cada fila abre el detalle para editarla.
export function ExpenseCatalogSheet({
  items,
  categories,
  language,
  onClose,
}: ExpenseCatalogSheetProps) {
  const catalog = useCatalogFilters(items);
  const [frequencyOpen, setFrequencyOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const { summary, filters } = catalog;
  const resultsLabel =
    catalog.visible.length === 1
      ? t("catalog.resultsOne", language)
      : t("catalog.results", language).replace("{count}", String(catalog.visible.length));

  return (
    <Sheet
      ariaLabel={t("catalog.title", language)}
      onBackdropClick={onClose}
      contentClassName="max-h-[88dvh] sm:max-w-lg"
    >
      <section className="grid gap-3 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-semibold leading-tight text-[var(--app-text)]">
              <LayoutList size={20} className="text-[var(--app-accent)]" aria-hidden="true" />
              {t("catalog.title", language)}
            </h2>
            <p className="mt-1 text-sm font-medium text-[var(--app-text-muted)]">
              {t("catalog.summary", language)
                .replace("{count}", String(summary.activeCount))
                .replace("{monthly}", formatCurrency(summary.monthlyAverage))
                .replace("{yearly}", formatCurrency(summary.yearlyTotal))}
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

        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]"
          />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => catalog.update({ query: event.target.value })}
            aria-label={t("catalog.searchLabel", language)}
            placeholder={t("catalog.searchPlaceholder", language)}
            autoComplete="off"
            // .input-control fija su padding: el hueco del icono va en línea.
            style={{ paddingLeft: "2.25rem" }}
            className="input-control w-full"
          />
        </div>

        <div
          role="group"
          aria-label={t("catalog.filterStatus", language)}
          className="grid grid-cols-3 gap-1.5"
        >
          {STATUS_OPTIONS.map(([status, labelKey]) => (
            <button
              key={status}
              type="button"
              aria-pressed={filters.status === status}
              onClick={() => catalog.update({ status })}
              className="app-control min-h-10 px-2 text-xs font-bold"
            >
              {t(labelKey, language)}
            </button>
          ))}
        </div>

        {/* Uno debajo del otro en móvil: así se lee el valor elegido entero. */}
        <div className="grid gap-2 min-[480px]:grid-cols-2">
          <SelectMenu
            open={frequencyOpen}
            onOpenChange={setFrequencyOpen}
            value={filters.frequency}
            align="left"
            label={`${t("catalog.filterFrequency", language)}: ${t(
              FREQUENCY_OPTIONS.find(([value]) => value === filters.frequency)?.[1] ??
                "catalog.frequencyAll",
              language,
            )}`}
            options={FREQUENCY_OPTIONS.map(([value, labelKey]) => ({
              value,
              label: t(labelKey, language),
            }))}
            keepOrder
            onChange={(frequency) => catalog.update({ frequency })}
          />
          <SelectMenu
            keepOrder
            open={categoryOpen}
            onOpenChange={setCategoryOpen}
            value={filters.categoryId}
            label={`${t("catalog.filterCategory", language)}: ${
              filters.categoryId === ALL_CATEGORIES
                ? t("catalog.categoryAll", language)
                : categoryLabel(categoriesById.get(filters.categoryId)?.name ?? "", language)
            }`}
            options={[
              { value: ALL_CATEGORIES, label: t("catalog.categoryAll", language) },
              ...catalog.categoryIds.flatMap((categoryId) => {
                const category = categoriesById.get(categoryId);
                return category
                  ? [{ value: categoryId, label: categoryLabel(category.name, language) }]
                  : [];
              }),
            ]}
            onChange={(categoryId) => catalog.update({ categoryId })}
          />
        </div>

        <div className="flex min-h-8 items-center justify-between gap-2">
          <p aria-live="polite" className="text-xs font-semibold text-[var(--app-text-muted)]">
            {resultsLabel}
          </p>
          {catalog.filtered ? (
            <Button type="button" variant="ghost" size="sm" onClick={catalog.clear}>
              {t("catalog.clearFilters", language)}
            </Button>
          ) : null}
        </div>

        {catalog.visible.length ? (
          <ul className="grid gap-2" aria-label={t("catalog.title", language)}>
            {catalog.visible.map((item) => (
              <CatalogItemCard
                key={item.template.id}
                item={item}
                category={categoriesById.get(item.template.categoryId)}
                language={language}
              />
            ))}
          </ul>
        ) : (
          <p className="app-empty-line p-5 text-sm font-medium">
            {items.length ? t("catalog.noResults", language) : t("catalog.empty", language)}
          </p>
        )}
      </section>
    </Sheet>
  );
}
