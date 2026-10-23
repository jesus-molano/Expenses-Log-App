import { addDays, format, isSameDay, isWeekend, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import {
  CALENDAR_CYCLE,
  periodIdOf,
  periodStart,
  type BudgetCycle,
} from "@/domain/budget-cycle";
import { daysBetween } from "@/domain/calendar";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";
import {
  resolveExpenseVisualState,
  type ExpenseVisualState,
} from "./expense-visual-state";

export type TimelineSection = {
  id: string;
  title: string;
  subtitle: string;
  tone: ExpenseVisualState;
  priority: number;
  total: number;
  items: ExpenseOccurrence[];
  anchorDate: string;
};

function sectionMeta(
  occurrence: ExpenseOccurrence,
  today: string,
  language: AppLanguage,
  cycle: BudgetCycle,
): Pick<TimelineSection, "id" | "title" | "subtitle" | "tone" | "priority"> {
  const dueDate = parseISO(occurrence.dueDate);
  const locale = language === "en" ? enUS : es;
  const dayLabel = (date: Date) => format(date, "EEEE d", { locale });
  const visualState = resolveExpenseVisualState(occurrence, today);

  if (visualState === "paid") {
    return {
      id: `paid-${occurrence.dueDate}`,
      title: dayLabel(dueDate),
      subtitle: t("expenses.paid", language),
      tone: visualState,
      priority: 0,
    };
  }

  const dueMonthId = periodIdOf(occurrence.dueDate, cycle);
  if (visualState === "overdue" && dueMonthId < periodIdOf(today, cycle)) {
    return {
      id: `carry-over-${dueMonthId}`,
      title: t("expenses.carryOverTitle", language).replace(
        "{month}",
        format(parseISO(`${dueMonthId}-01`), "LLLL", { locale }),
      ),
      subtitle: t("expenses.carryOverSubtitle", language),
      tone: visualState,
      priority: 1,
    };
  }

  if (visualState === "overdue") {
    return {
      id: "overdue",
      title: t("expenses.overdue", language),
      subtitle: t("expenses.overduePending", language),
      tone: visualState,
      priority: 1,
    };
  }

  if (occurrence.dueDate === today || occurrence.estimatedChargeDate === today) {
    return {
      id: "today",
      title: t("expenses.today", language),
      subtitle: t("expenses.canLeaveToday", language),
      tone: visualState,
      priority: 2,
    };
  }

  if (visualState === "estimated") {
    return {
      id: `future-${occurrence.dueDate}`,
      title: dayLabel(dueDate),
      subtitle: `${t("expenses.estimated", language)} ${dayLabel(parseISO(occurrence.estimatedChargeDate))}`,
      tone: visualState,
      priority: 3,
    };
  }

  return {
    id: `future-${occurrence.dueDate}`,
    title: isSameDay(dueDate, addDays(parseISO(today), 1))
      ? t("expenses.tomorrow", language)
      : dayLabel(dueDate),
    subtitle: isWeekend(dueDate)
      ? t("expenses.weekendDue", language)
      : t("expenses.pending", language),
    tone: visualState,
    priority: 3,
  };
}

// `monthId` es el mes de presupuesto que se mira y `cycle`, cómo se reparten
// los días en meses (natural o desde el día de cobro).
export function buildTimelineSections(
  occurrences: ExpenseOccurrence[],
  today: string,
  language: AppLanguage = "es",
  monthId: string = today.slice(0, 7),
  cycle: BudgetCycle = CALENDAR_CYCLE,
): TimelineSection[] {
  const sections = new Map<string, TimelineSection>();

  for (const occurrence of occurrences) {
    const meta = sectionMeta(occurrence, today, language, cycle);
    const existing = sections.get(meta.id);

    if (existing) {
      existing.items.push(occurrence);
      existing.total += occurrence.status === "paid" ? 0 : occurrence.template.amount;
      continue;
    }

    sections.set(meta.id, {
      ...meta,
      anchorDate: occurrence.dueDate,
      total: occurrence.status === "paid" ? 0 : occurrence.template.amount,
      items: [occurrence],
    });
  }

  const timelineSections = Array.from(sections.values())
    .map((section) => ({
      ...section,
      items: section.items.sort((a, b) => {
        if (a.estimatedChargeDate !== b.estimatedChargeDate) {
          return a.estimatedChargeDate.localeCompare(b.estimatedChargeDate);
        }
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.template.name.localeCompare(b.template.name);
      }),
    }))
    .sort((a, b) => sortSections(a, b, today));

  const placeholder = placeholderSection(today, monthId, language, cycle);
  if (
    placeholder &&
    !timelineSections.some((section) => section.id === placeholder.id)
  ) {
    timelineSections.push(placeholder);
  }

  return timelineSections.sort((a, b) => sortSections(a, b, today));
}

// Punto de referencia vacío: "Hoy" en el mes natural y, si se mira el mes
// siguiente antes de que empiece, cuántos días faltan. Un mes pasado no lleva.
function placeholderSection(
  today: string,
  monthId: string,
  language: AppLanguage,
  cycle: BudgetCycle,
): TimelineSection | null {
  const base = { tone: "pending" as const, priority: 2, total: 0, items: [] };
  const todayMonthId = periodIdOf(today, cycle);
  if (monthId === todayMonthId) {
    return {
      ...base,
      id: "today",
      title: t("expenses.today", language),
      subtitle: t("expenses.controlPoint", language),
      anchorDate: today,
    };
  }
  if (monthId < todayMonthId) return null;

  const monthStart = periodStart(monthId, cycle);
  const days = daysBetween(today, monthStart);
  const month = format(parseISO(`${monthId}-01`), "LLLL", {
    locale: language === "en" ? enUS : es,
  });
  return {
    ...base,
    id: "month-start",
    title: (days === 1
      ? t("expenses.monthStartsTomorrow", language)
      : t("expenses.monthStartsIn", language).replace("{days}", String(days))
    ).replace("{month}", month),
    subtitle: t("expenses.monthStartsSubtitle", language),
    anchorDate: monthStart,
  };
}

function sortSections(
  a: TimelineSection,
  b: TimelineSection,
  today: string,
): number {
  const aDate = a.id === "overdue" ? today : a.anchorDate;
  const bDate = b.id === "overdue" ? today : b.anchorDate;

  if (a.priority !== b.priority) return a.priority - b.priority;
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return a.title.localeCompare(b.title);
}

