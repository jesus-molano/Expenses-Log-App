import {
  CATEGORY_NAME_MAX_LENGTH,
  CUSTOM_CATEGORY_ICON,
  findPresetCategory,
  validateCategoryName,
  type CategoryInput,
} from "@/domain/categories";
import type { ExpenseCategory, ExpenseStore } from "@/domain/types";
import {
  createId,
  findCategoryByName,
  findOrCreateCategory,
} from "@/features/expenses/lib/expense-actions";

export type { CategoryInput };

// Crea una categoría propia. Si ya hay una con ese nombre se reutiliza (sin
// cambiarla): el formulario la selecciona igual.
export function createCategoryInStore(
  store: ExpenseStore,
  input: CategoryInput,
  now: string = new Date().toISOString(),
): { store: ExpenseStore; categoryId: string | null } {
  const name = input.name.trim().slice(0, CATEGORY_NAME_MAX_LENGTH);
  const existing = findCategoryByName(store.categories, name);
  if (existing) return { store, categoryId: existing.id };
  if (validateCategoryName(store.categories, name)) return { store, categoryId: null };

  // Escribir el nombre de una preset ("ocio") crea esa preset con su icono.
  const preset = findPresetCategory(name);
  const category: ExpenseCategory = {
    id: createId("cat"),
    userId: "demo",
    name: preset?.name ?? name,
    icon: preset?.icon ?? CUSTOM_CATEGORY_ICON,
    tone: input.tone,
    updatedAt: now,
  };

  return {
    store: { ...store, categories: [...store.categories, category] },
    categoryId: category.id,
  };
}

// Renombra o cambia el color. Un nombre vacío o repetido no se aplica (el
// gestor lo valida antes con validateCategoryName).
export function updateCategoryInStore(
  store: ExpenseStore,
  categoryId: string,
  changes: Partial<CategoryInput>,
  now: string = new Date().toISOString(),
): ExpenseStore {
  const previous = store.categories.find((category) => category.id === categoryId);
  if (!previous) return store;

  const name = changes.name === undefined ? previous.name : changes.name.trim();
  if (name !== previous.name && validateCategoryName(store.categories, name, categoryId)) {
    return store;
  }
  const tone = changes.tone ?? previous.tone;
  if (name === previous.name && tone === previous.tone) return store;

  return {
    ...store,
    categories: store.categories.map((category) =>
      category.id === categoryId
        ? { ...category, name, tone, updatedAt: now }
        : category,
    ),
  };
}

// Borra una categoría pasando sus gastos, cobros editados e historial a otra
// (que se crea si es una preset que aún no existe). El id borrado queda como
// tombstone para que no vuelva al fusionar con otro dispositivo.
export function deleteCategoryInStore(
  store: ExpenseStore,
  categoryId: string,
  replacementName: string,
  now: string = new Date().toISOString(),
): ExpenseStore {
  const deleted = store.categories.find((category) => category.id === categoryId);
  if (!deleted) return store;

  const withoutDeleted = {
    ...store,
    categories: store.categories.filter((category) => category.id !== categoryId),
    deleted: {
      ...store.deleted,
      categories: Array.from(new Set([...(store.deleted?.categories ?? []), categoryId])),
    },
  };
  const inUse =
    store.templates.some((template) => template.categoryId === categoryId) ||
    store.overrides.some((override) => override.categoryId === categoryId) ||
    (store.occurrenceRecords ?? []).some((record) => record.categoryId === categoryId);
  // Sin nada que mover no se crea la categoría de destino.
  if (!inUse) return withoutDeleted;

  const replacement = findOrCreateCategory(withoutDeleted, replacementName);
  const target = replacement.store.categories.find(
    (category) => category.id === replacement.categoryId,
  );
  if (!target) return store;

  return {
    ...replacement.store,
    templates: replacement.store.templates.map((template) =>
      template.categoryId === categoryId
        ? { ...template, categoryId: target.id, updatedAt: now }
        : template,
    ),
    overrides: replacement.store.overrides.map((override) =>
      override.categoryId === categoryId
        ? { ...override, categoryId: target.id, updatedAt: now }
        : override,
    ),
    occurrenceRecords: replacement.store.occurrenceRecords?.map((record) =>
      record.categoryId === categoryId
        ? { ...record, categoryId: target.id, categoryName: target.name, updatedAt: now }
        : record,
    ),
  };
}
