"use client";

import { useMemo, useState } from "react";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import {
  DEFAULT_CATALOG_FILTERS,
  buildExpenseCatalog,
  catalogCategoryIds,
  countEndingCommitments,
  filterCatalog,
  hasActiveCatalogFilters,
  summarizeCatalog,
  type CatalogFilters,
  type CatalogItem,
} from "../lib/expense-catalog";

// Catálogo de series del store, recalculado solo cuando cambian los datos o
// el día.
export function useExpenseCatalog(store: ExpenseStore, today: string, language: AppLanguage) {
  return useMemo(() => {
    const names = new Map(
      store.categories.map((category) => [category.id, categoryLabel(category.name, language)]),
    );
    const items = buildExpenseCatalog({
      store,
      today,
      language,
      categoryNameOf: (categoryId) => names.get(categoryId) ?? "",
    });
    return { items, endingCommitments: countEndingCommitments(items) };
  }, [store, today, language]);
}

// Búsqueda y filtros de la hoja "Todos"; empiezan de cero cada vez que se abre.
export function useCatalogFilters(items: CatalogItem[]) {
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const visible = useMemo(() => filterCatalog(items, filters), [items, filters]);
  const categoryIds = useMemo(() => catalogCategoryIds(items), [items]);

  function update(patch: Partial<CatalogFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  return {
    filters,
    visible,
    summary: summarizeCatalog(visible),
    categoryIds,
    filtered: hasActiveCatalogFilters(filters),
    update,
    clear: () => setFilters(DEFAULT_CATALOG_FILTERS),
  };
}
