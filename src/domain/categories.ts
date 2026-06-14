import type { CategoryTone } from "./types";

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

export function resolvePresetCategory(name: string): PresetExpenseCategory {
  return (
    PRESET_EXPENSE_CATEGORIES.find(
      (category) => category.name.toLowerCase() === name.trim().toLowerCase(),
    ) ?? PRESET_EXPENSE_CATEGORIES.at(-1)!
  );
}
