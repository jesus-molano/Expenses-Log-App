import { addDays, format, isSameDay, isWeekend, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { daysBetween } from "@/domain/calendar";
import type { AppLanguage, ExpenseOccurrence } from "@/domain/types";
import { t } from "@/shared/i18n";

export type TimelineSection = {
  id: string;
  title: string;
  subtitle: string;
  tone: "critical" | "soon" | "estimated" | "later" | "paid";
  priority: number;
  total: number;
  items: ExpenseOccurrence[];
  anchorDate: string;
};

function sectionMeta(
  occurrence: ExpenseOccurrence,
  today: string,
  language: AppLanguage,
): Pick<TimelineSection, "id" | "title" | "subtitle" | "tone" | "priority"> {
  const dueDate = parseISO(occurrence.dueDate);
  const dueDelta = daysBetween(today, occurrence.dueDate);
  const locale = language === "en" ? enUS : es;
  const dayLabel = (date: Date) => format(date, "EEEE d", { locale });

  if (occurrence.status === "paid") {
    return {
      id: `paid-${occurrence.dueDate}`,
      title: dayLabel(dueDate),
      subtitle: t("expenses.paid", language),
      tone: "paid",
      priority: 0,
    };
  }

  if (dueDelta < 0) {
    return {
      id: "overdue",
      title: t("expenses.overdue", language),
      subtitle: `${t("expenses.from", language)} ${dayLabel(dueDate)}`,
      tone: "critical",
      priority: 1,
    };
  }

  if (occurrence.dueDate === today || occurrence.estimatedChargeDate === today) {
    return {
      id: "today",
      title: t("expenses.today", language),
      subtitle: t("expenses.canLeaveToday", language),
      tone: "critical",
      priority: 2,
    };
  }

  const estimatedDelta = daysBetween(today, occurrence.estimatedChargeDate);

  if (
    occurrence.estimatedChargeDate !== occurrence.dueDate &&
    estimatedDelta <= 7
  ) {
    return {
      id: `future-${occurrence.dueDate}`,
      title: dayLabel(dueDate),
      subtitle: `${t("expenses.estimated", language)} ${dayLabel(parseISO(occurrence.estimatedChargeDate))}`,
      tone: "estimated",
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
    tone: dueDelta <= 7 ? "soon" : "later",
    priority: 3,
  };
}

export function buildTimelineSections(
  occurrences: ExpenseOccurrence[],
  today: string,
  language: AppLanguage = "es",
): TimelineSection[] {
  const sections = new Map<string, TimelineSection>();

  for (const occurrence of occurrences) {
    const meta = sectionMeta(occurrence, today, language);
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

  if (!timelineSections.some((section) => section.id === "today")) {
    timelineSections.push({
      id: "today",
      title: t("expenses.today", language),
      subtitle: t("expenses.controlPoint", language),
      tone: "soon",
      priority: 2,
      total: 0,
      anchorDate: today,
      items: [],
    });
  }

  return timelineSections.sort((a, b) => sortSections(a, b, today));
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

