import type { CategoryTone } from "./types";

export type PresetExpenseCategory = {
  name: string;
  icon: string;
  tone: CategoryTone;
  tags: string[];
};

export const PRESET_EXPENSE_CATEGORIES: PresetExpenseCategory[] = [
  {
    name: "Casa",
    icon: "Home",
    tone: "green",
    tags: ["casa", "piso", "compra", "gatos"],
  },
  {
    name: "Suscripciones",
    icon: "Sparkles",
    tone: "violet",
    tags: ["suscripciones", "streaming", "software"],
  },
  {
    name: "Servicios",
    icon: "WalletCards",
    tone: "blue",
    tags: ["servicios", "internet", "movil", "luz"],
  },
  {
    name: "Transporte",
    icon: "Car",
    tone: "orange",
    tags: ["transporte", "coche", "parking", "gasolina"],
  },
  {
    name: "Salud",
    icon: "HeartPulse",
    tone: "rose",
    tags: ["salud", "seguro", "medico"],
  },
  {
    name: "Deudas",
    icon: "CreditCard",
    tone: "rose",
    tags: ["deudas", "prestamo", "tarjeta"],
  },
  {
    name: "Ocio",
    icon: "Gamepad2",
    tone: "violet",
    tags: ["ocio", "juegos", "salidas"],
  },
  {
    name: "Personal",
    icon: "User",
    tone: "green",
    tags: ["personal", "gym", "formacion"],
  },
  {
    name: "General",
    icon: "WalletCards",
    tone: "slate",
    tags: ["general", "anual"],
  },
];

export const PRESET_EXPENSE_TAGS = Array.from(
  new Set(PRESET_EXPENSE_CATEGORIES.flatMap((category) => category.tags)),
);

export function resolvePresetCategory(name: string): PresetExpenseCategory {
  return (
    PRESET_EXPENSE_CATEGORIES.find(
      (category) => category.name.toLowerCase() === name.trim().toLowerCase(),
    ) ?? PRESET_EXPENSE_CATEGORIES.at(-1)!
  );
}
