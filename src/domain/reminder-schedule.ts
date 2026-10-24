import { addDays, subDays } from "date-fns";
import { periodRange, resolveBudgetCycle } from "./budget-cycle";
import {
  addMonthId,
  buildMonthContext,
  monthRange,
  paydayMonthOn,
  shouldSuggestAdvance,
} from "./budget-month";
import {
  APP_TIME_ZONE,
  daysBetween,
  isValidTimeZone,
  toDateOnly,
} from "./calendar";
import { occurrencesDueBetween } from "./finance";
import { monthPendingSummary } from "./pending";
import type {
  AppLanguage,
  ExpenseOccurrence,
  ExpenseReminderSettings,
  ExpenseStore,
  ExpenseTemplate,
  RecurrenceRule,
  ReminderPreferences,
} from "./types";

// Etapas de aviso de un cobro: antes, el día del cargo y "¿se cobró?" cuando
// el cargo ya pasó y sigue pendiente.
export type ReminderStage = "before" | "charge_day" | "charge_check";

// Antelaciones que se ofrecen: hasta 5 días en los ciclos cortos y hasta un
// mes en trimestrales y anuales, que suelen pedir más margen para cancelar.
export const SHORT_CYCLE_LEAD_DAYS = [1, 2, 3, 4, 5] as const;
export const LONG_CYCLE_LEAD_DAYS = [7, 14, 30] as const;
export const LONG_CYCLE_FORM_LEAD_DAYS = [1, 3, 7, 14, 30] as const;
export const MAX_REMINDER_LEAD_DAYS = 30;
// Días después del cargo en los que aún se pregunta "¿se cobró?". Cubre un
// fin de semana sin ejecuciones del cron.
export const CHARGE_CHECK_WINDOW_DAYS = 3;

const EPOCH = "1970-01-01T00:00:00.000Z";

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  defaultEnabled: false,
  defaultDaysBefore: 3,
  longCycleDaysBefore: 14,
  onChargeDay: true,
  askIfCharged: true,
  monthClose: false,
  payday: false,
  // El cron diario corre a las 08:00 UTC: las 8 o las 9 en Canarias.
  pushHour: 8,
  timeZone: APP_TIME_ZONE,
  updatedAt: EPOCH,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const number = Number(value);
  if (value === null || value === "" || !Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

function booleanOr(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function clampLeadDays(value: unknown, fallback = 3) {
  return boundedInteger(value, 1, MAX_REMINDER_LEAD_DAYS, fallback);
}

// Ajustes de avisos legibles o undefined si no hay ninguno. Conserva las
// claves que escriba un build más nuevo.
export function sanitizeReminderPreferences(
  value: unknown,
): ReminderPreferences | undefined {
  if (!isRecord(value)) return undefined;
  const defaults = DEFAULT_REMINDER_PREFERENCES;

  return {
    ...value,
    defaultEnabled: booleanOr(value.defaultEnabled, defaults.defaultEnabled),
    defaultDaysBefore: clampLeadDays(value.defaultDaysBefore, defaults.defaultDaysBefore),
    longCycleDaysBefore: clampLeadDays(
      value.longCycleDaysBefore,
      defaults.longCycleDaysBefore,
    ),
    onChargeDay: booleanOr(value.onChargeDay, defaults.onChargeDay),
    askIfCharged: booleanOr(value.askIfCharged, defaults.askIfCharged),
    monthClose: booleanOr(value.monthClose, defaults.monthClose),
    payday: booleanOr(value.payday, defaults.payday),
    pushHour: boundedInteger(value.pushHour, 0, 23, defaults.pushHour),
    timeZone: isValidTimeZone(value.timeZone) ? value.timeZone : defaults.timeZone,
    updatedAt:
      typeof value.updatedAt === "string" && !Number.isNaN(Date.parse(value.updatedAt))
        ? value.updatedAt
        : EPOCH,
  };
}

export function sanitizeTemplateReminder(
  value: unknown,
): ExpenseReminderSettings | undefined {
  if (!isRecord(value)) return undefined;
  return {
    enabled: value.enabled === true,
    daysBeforeCharge: clampLeadDays(value.daysBeforeCharge),
  };
}

export function resolveReminderPreferences(
  store: Pick<ExpenseStore, "preferences">,
): ReminderPreferences {
  return (
    sanitizeReminderPreferences(store.preferences?.reminders) ??
    DEFAULT_REMINDER_PREFERENCES
  );
}

// Trimestrales, anuales y personalizados de 3 meses o más.
export function isLongCycleRecurrence(rule: RecurrenceRule) {
  if (rule.frequency === "quarterly" || rule.frequency === "yearly") return true;
  if (rule.frequency !== "custom") return false;
  const interval = Math.max(rule.interval ?? 1, 1);
  const unit = rule.unit ?? "month";
  return unit === "year" || (unit === "month" && interval >= 3);
}

export function leadDayOptions(rule: RecurrenceRule): readonly number[] {
  return isLongCycleRecurrence(rule)
    ? LONG_CYCLE_FORM_LEAD_DAYS
    : SHORT_CYCLE_LEAD_DAYS;
}

export type ResolvedReminder = ExpenseReminderSettings & {
  // "template": el gasto tiene aviso propio; "default": sigue Ajustes.
  source: "template" | "default";
};

export function resolveTemplateReminder(
  template: Pick<ExpenseTemplate, "reminder" | "recurrence">,
  preferences: ReminderPreferences,
): ResolvedReminder {
  if (template.reminder) {
    return {
      enabled: template.reminder.enabled,
      daysBeforeCharge: clampLeadDays(template.reminder.daysBeforeCharge),
      source: "template",
    };
  }

  return {
    enabled: preferences.defaultEnabled,
    daysBeforeCharge: isLongCycleRecurrence(template.recurrence)
      ? preferences.longCycleDaysBefore
      : preferences.defaultDaysBefore,
    source: "default",
  };
}

// La campana de una fila: invierte el aviso efectivo y lo deja como ajuste
// propio del gasto, que ya no cambia con el aviso por defecto.
export function toggledTemplateReminder(
  template: Pick<ExpenseTemplate, "reminder" | "recurrence">,
  preferences: ReminderPreferences,
): ExpenseReminderSettings {
  const current = resolveTemplateReminder(template, preferences);
  return { enabled: !current.enabled, daysBeforeCharge: current.daysBeforeCharge };
}

export function reminderStageFor(
  daysUntilCharge: number,
  leadDays: number,
  preferences: Pick<ReminderPreferences, "onChargeDay" | "askIfCharged">,
): ReminderStage | null {
  if (daysUntilCharge === 0 && preferences.onChargeDay) return "charge_day";
  // Sin la etapa del día del cargo, ese día sigue siendo "antes" (como hasta
  // ahora). La ventana entera recupera una ejecución perdida del cron.
  if (daysUntilCharge >= 0 && daysUntilCharge <= leadDays) return "before";
  if (
    daysUntilCharge < 0 &&
    daysUntilCharge >= -CHARGE_CHECK_WINDOW_DAYS &&
    preferences.askIfCharged
  ) {
    return "charge_check";
  }
  return null;
}

export type ScheduledReminder = {
  stage: ReminderStage;
  occurrence: ExpenseOccurrence;
  // Días hasta el cargo estimado; negativo si ya pasó.
  daysUntilCharge: number;
};

const STAGE_ORDER: Record<ReminderStage, number> = {
  charge_check: 0,
  charge_day: 1,
  before: 2,
};

// Cobros que tocan avisar hoy, con su etapa. Usa las mismas ocurrencias que
// la app (registros de meses cerrados y recibos movidos incluidos) y el aviso
// de la serie actual: un gasto borrado no avisa.
export function buildOccurrenceReminders(
  store: ExpenseStore,
  today: Date,
  language: AppLanguage = store.preferences?.language ?? "es",
): ScheduledReminder[] {
  const preferences = resolveReminderPreferences(store);
  const todayKey = toDateOnly(today);
  const templatesById = new Map(store.templates.map((template) => [template.id, template]));
  // El cargo estimado cae hasta 2 días después del vencimiento (fin de semana).
  const from = toDateOnly(subDays(today, CHARGE_CHECK_WINDOW_DAYS + 2));
  const to = toDateOnly(addDays(today, MAX_REMINDER_LEAD_DAYS));

  return occurrencesDueBetween(store, from, to, language)
    .flatMap((occurrence): ScheduledReminder[] => {
      if (occurrence.status !== "due") return [];
      const template = templatesById.get(occurrence.template.id);
      if (!template?.active) return [];
      const reminder = resolveTemplateReminder(template, preferences);
      if (!reminder.enabled) return [];

      const daysUntilCharge = daysBetween(todayKey, occurrence.estimatedChargeDate);
      const stage = reminderStageFor(daysUntilCharge, reminder.daysBeforeCharge, preferences);
      if (!stage) return [];
      // "Entendido" en el aviso de la app calla los avisos previos de ese
      // cargo, pero no la pregunta de si se cobró.
      const dismissed =
        occurrence.override?.reminderDismissedChargeDate ===
        occurrence.estimatedChargeDate;
      if (dismissed && stage !== "charge_check") return [];

      return [{ stage, occurrence, daysUntilCharge }];
    })
    .sort(
      (left, right) =>
        STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage] ||
        left.daysUntilCharge - right.daysUntilCharge ||
        left.occurrence.dueDate.localeCompare(right.occurrence.dueDate),
    );
}

export type MonthCloseNotice = {
  monthId: string;
  nextMonthId: string;
  paidCount: number;
};

// El mismo criterio que la tarjeta "Octubre al día" de Gastos.
export function buildMonthCloseNotice(
  store: ExpenseStore,
  today: string,
  language: AppLanguage = "es",
): MonthCloseNotice | null {
  const context = buildMonthContext(store, today, language);
  if (context.activeMonthId !== context.calendarMonthId) return null;
  if (
    !shouldSuggestAdvance({
      status: context.closeStatus,
      today,
      payday: context.payday,
      cycle: context.cycle,
    })
  ) {
    return null;
  }

  return {
    monthId: context.calendarMonthId,
    nextMonthId: context.nextMonthId,
    paidCount: context.closeStatus.paidCount,
  };
}

export type PaydayNotice = {
  monthId: string;
  pendingCount: number;
  pendingTotal: number;
};

// El día de cobro (el mismo que "¿Has cobrado?": el último del mes si el mes
// es más corto o, con el ciclo anclado al cobro, el que abre el mes), con lo
// que queda por pagar del mes de presupuesto de ese sueldo.
export function buildPaydayNotice(
  store: ExpenseStore,
  today: string,
  language: AppLanguage = "es",
): PaydayNotice | null {
  const monthId = paydayMonthOn(store.finance, today);
  if (monthId === null) return null;

  const range = periodRange(monthId, resolveBudgetCycle(store.finance));
  const pending = monthPendingSummary(
    occurrencesDueBetween(store, range.start, range.end, language),
    monthId,
    range,
  );
  return { monthId, pendingCount: pending.count, pendingTotal: pending.total };
}

// Recibos que piden atención hoy (vencidos o que vencen hoy), para el número
// del icono de la app. Mira desde el mes anterior, como "Pendiente de <mes>".
export function countAttentionOccurrences(
  store: ExpenseStore,
  today: Date,
  language: AppLanguage = "es",
): number {
  const todayKey = toDateOnly(today);
  const from = monthRange(addMonthId(todayKey.slice(0, 7), -1)).start;
  const templateIds = new Set(store.templates.map((template) => template.id));

  return occurrencesDueBetween(store, from, todayKey, language).filter(
    (occurrence) =>
      occurrence.status === "due" && templateIds.has(occurrence.template.id),
  ).length;
}
