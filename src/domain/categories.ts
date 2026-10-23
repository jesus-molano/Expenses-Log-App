import { foldText } from "./text";
import type { CategoryTone, ExpenseCategory, ExpenseStore } from "./types";

export type PresetExpenseCategory = {
  name: string;
  icon: string;
  tone: CategoryTone;
};

export const PRESET_EXPENSE_CATEGORIES: PresetExpenseCategory[] = [
  { name: "Casa", icon: "Home", tone: "green" },
  { name: "Alimentacion", icon: "Utensils", tone: "orange" },
  { name: "Servicios", icon: "WalletCards", tone: "blue" },
  { name: "Suscripciones", icon: "Sparkles", tone: "violet" },
  { name: "Vehiculo", icon: "Car", tone: "orange" },
  { name: "Transporte", icon: "TrainFront", tone: "blue" },
  { name: "Salud", icon: "HeartPulse", tone: "rose" },
  { name: "Deporte", icon: "Dumbbell", tone: "green" },
  { name: "Deudas", icon: "CreditCard", tone: "rose" },
  { name: "Ahorro", icon: "PiggyBank", tone: "green" },
  { name: "Ocio", icon: "Gamepad2", tone: "violet" },
  { name: "Educacion/Trabajo", icon: "BriefcaseBusiness", tone: "blue" },
  { name: "Mascotas", icon: "PawPrint", tone: "green" },
  { name: "Personal", icon: "User", tone: "green" },
  { name: "General", icon: "WalletCards", tone: "slate" },
];

export const CATEGORY_TONES: CategoryTone[] = [
  "blue",
  "green",
  "orange",
  "rose",
  "violet",
  "slate",
];

// Icono de las categorías que crea el usuario (las preset tienen el suyo).
export const CUSTOM_CATEGORY_ICON = "Tag";
export const CATEGORY_NAME_MAX_LENGTH = 30;

export function resolvePresetCategory(name: string): PresetExpenseCategory {
  return findPresetCategory(name) ?? PRESET_EXPENSE_CATEGORIES.at(-1)!;
}

// La preset con ese nombre (sin tildes ni mayúsculas), si existe.
export function findPresetCategory(name: string): PresetExpenseCategory | undefined {
  const folded = foldText(name);
  return PRESET_EXPENSE_CATEGORIES.find((category) => foldText(category.name) === folded);
}

export function isCategoryTone(value: unknown): value is CategoryTone {
  return CATEGORY_TONES.includes(value as CategoryTone);
}

export type CategoryNameError = "empty" | "tooLong" | "duplicate";

// Un nombre vacío, demasiado largo o que ya usa otra categoría del usuario no
// vale: dos categorías con el mismo nombre serían indistinguibles al elegir.
export function validateCategoryName(
  categories: Array<Pick<ExpenseCategory, "id" | "name">>,
  name: string,
  exceptId?: string,
): CategoryNameError | null {
  const trimmed = name.trim();
  if (!trimmed) return "empty";
  if (trimmed.length > CATEGORY_NAME_MAX_LENGTH) return "tooLong";
  const folded = foldText(trimmed);
  const taken = categories.some(
    (category) => category.id !== exceptId && foldText(category.name) === folded,
  );
  return taken ? "duplicate" : null;
}

export type CategoryOption = {
  name: string;
  icon: string;
  tone: CategoryTone;
  // Id de la categoría guardada, si ya existe en el store.
  id?: string;
  // Creada por el usuario (no es una preset).
  custom: boolean;
};

// Lo que se puede elegir: las preset, con el color que el usuario les haya
// dado, y después las propias por orden alfabético. Una preset renombrada
// pasa a ser propia y la preset original sigue disponible.
export function buildCategoryOptions(categories: ExpenseCategory[]): CategoryOption[] {
  const byName = new Map(categories.map((category) => [foldText(category.name), category]));
  const presets = PRESET_EXPENSE_CATEGORIES.map((preset): CategoryOption => {
    const stored = byName.get(foldText(preset.name));
    return {
      name: preset.name,
      icon: preset.icon,
      tone: stored?.tone ?? preset.tone,
      id: stored?.id,
      custom: false,
    };
  });
  const presetNames = new Set(PRESET_EXPENSE_CATEGORIES.map((preset) => foldText(preset.name)));
  const custom = categories
    .filter((category) => !presetNames.has(foldText(category.name)))
    .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
    .map(
      (category): CategoryOption => ({
        name: category.name,
        icon: category.icon || CUSTOM_CATEGORY_ICON,
        tone: category.tone,
        id: category.id,
        custom: true,
      }),
    );
  return [...presets, ...custom];
}

export type CategoryUsage = {
  // Series (gastos) que la usan.
  templates: number;
  // Cobros sueltos editados con esa categoría.
  occurrences: number;
};

export function categoryUsage(store: ExpenseStore, categoryId: string): CategoryUsage {
  return {
    templates: store.templates.filter((template) => template.categoryId === categoryId)
      .length,
    occurrences: store.overrides.filter((override) => override.categoryId === categoryId)
      .length,
  };
}
