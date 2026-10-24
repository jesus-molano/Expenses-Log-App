import { toDateOnly } from "@/domain/calendar";
import { foldText } from "@/domain/text";
import type { AppLanguage, DraftExpense, ExpenseTemplate, RecurrenceRule } from "@/domain/types";
import { t, type TranslationKey } from "@/shared/i18n";

export type QuickAddPreset = {
  id: string;
  labelKey: TranslationKey;
  categoryName: string;
  recurrence: RecurrenceRule;
  // Día de cobro habitual; sin él, el de hoy.
  dueDay?: number;
};

// Gastos fijos habituales en España, para dar de alta con un toque. Solo
// falta el importe (y ajustar el día si no es el habitual).
export const QUICK_ADD_PRESETS: QuickAddPreset[] = [
  { id: "rent", labelKey: "onboarding.rent", categoryName: "Casa", recurrence: { frequency: "monthly" }, dueDay: 1 },
  { id: "electricity", labelKey: "onboarding.electricity", categoryName: "Casa", recurrence: { frequency: "monthly" } },
  {
    id: "water",
    labelKey: "onboarding.water",
    categoryName: "Casa",
    // El agua suele facturarse cada dos meses.
    recurrence: { frequency: "custom", interval: 2, unit: "month" },
  },
  { id: "internet", labelKey: "onboarding.internet", categoryName: "Servicios", recurrence: { frequency: "monthly" } },
  { id: "mobile", labelKey: "onboarding.mobile", categoryName: "Servicios", recurrence: { frequency: "monthly" } },
  { id: "netflix", labelKey: "onboarding.netflix", categoryName: "Suscripciones", recurrence: { frequency: "monthly" } },
  { id: "spotify", labelKey: "onboarding.spotify", categoryName: "Suscripciones", recurrence: { frequency: "monthly" } },
  { id: "gym", labelKey: "onboarding.gym", categoryName: "Deporte", recurrence: { frequency: "monthly" }, dueDay: 1 },
  { id: "carInsurance", labelKey: "onboarding.carInsurance", categoryName: "Vehiculo", recurrence: { frequency: "yearly" } },
  { id: "homeInsurance", labelKey: "onboarding.homeInsurance", categoryName: "Casa", recurrence: { frequency: "yearly" } },
];

// Las que aún no existen (por nombre, en cualquiera de los dos idiomas).
export function availableQuickAdds(
  presets: QuickAddPreset[],
  templates: Pick<ExpenseTemplate, "name">[],
): QuickAddPreset[] {
  const existing = new Set(templates.map((template) => foldText(template.name)));
  return presets.filter(
    (preset) =>
      !existing.has(foldText(t(preset.labelKey, "es"))) &&
      !existing.has(foldText(t(preset.labelKey, "en"))),
  );
}

// Borrador para el formulario: sin importe (el campo empieza vacío y es
// obligatorio). Un anual se cobra este mes salvo que el usuario lo cambie.
export function buildQuickAddDraft(
  preset: QuickAddPreset,
  language: AppLanguage,
  today: Date,
): DraftExpense {
  return {
    name: t(preset.labelKey, language),
    description: "",
    amount: 0,
    categoryName: preset.categoryName,
    startDate: toDateOnly(today),
    dueDay: preset.dueDay ?? today.getDate(),
    recurrence:
      preset.recurrence.frequency === "yearly"
        ? { ...preset.recurrence, annualMonth: today.getMonth() + 1 }
        : { ...preset.recurrence },
  };
}

export type OnboardingStepId = "salary" | "expense" | "notifications" | "install";

export type OnboardingChecklist = {
  steps: Array<{ id: OnboardingStepId; done: boolean }>;
  doneCount: number;
  total: number;
  complete: boolean;
};

export function buildOnboardingChecklist(state: {
  hasSalary: boolean;
  hasExpense: boolean;
  notificationsEnabled: boolean;
  installed: boolean;
}): OnboardingChecklist {
  const steps: OnboardingChecklist["steps"] = [
    { id: "expense", done: state.hasExpense },
    { id: "salary", done: state.hasSalary },
    { id: "notifications", done: state.notificationsEnabled },
    { id: "install", done: state.installed },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  return { steps, doneCount, total: steps.length, complete: doneCount === steps.length };
}

// Se ve con el store vacío y, si el usuario empezó aquí (añadió su primer
// gasto), hasta que lo oculta. Mientras carga la nube con el store vacío no
// se enseña, para no mostrársela a alguien con datos en otro dispositivo.
export function shouldShowOnboarding({
  templateCount,
  started,
  dismissed,
  syncing,
}: {
  templateCount: number;
  started: boolean;
  dismissed: boolean;
  syncing: boolean;
}) {
  if (dismissed) return false;
  if (templateCount === 0) return !syncing;
  return started;
}
