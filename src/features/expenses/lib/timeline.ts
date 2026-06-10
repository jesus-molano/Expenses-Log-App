import { addDays, format, isSameDay, isWeekend, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { ExpenseOccurrence } from "@/domain/types";
import { daysBetween } from "@/domain/calendar";

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
): Pick<TimelineSection, "id" | "title" | "subtitle" | "tone" | "priority"> {
  const dueDate = parseISO(occurrence.dueDate);
  const dueDelta = daysBetween(today, occurrence.dueDate);

  if (occurrence.status === "paid" && dueDelta < 0) {
    return {
      id: `paid-${occurrence.dueDate}`,
      title: format(dueDate, "EEEE d", { locale: es }),
      subtitle: "Pagado",
      tone: "paid",
      priority: dueDelta,
    };
  }

  if (dueDelta < 0) {
    return {
      id: "overdue",
      title: "Atrasado",
      subtitle: `Desde ${format(dueDate, "EEEE d", { locale: es })}`,
      tone: "critical",
      priority: dueDelta,
    };
  }

  if (occurrence.dueDate === today || occurrence.estimatedChargeDate === today) {
    return {
      id: "today",
      title: "Hoy",
      subtitle: "Puede salir de tu cuenta hoy",
      tone: "critical",
      priority: 0,
    };
  }

  const estimatedDate = parseISO(occurrence.estimatedChargeDate);
  const estimatedDelta = daysBetween(today, occurrence.estimatedChargeDate);

  if (
    occurrence.estimatedChargeDate !== occurrence.dueDate &&
    estimatedDelta <= 7
  ) {
    return {
      id: `estimated-${occurrence.estimatedChargeDate}`,
      title: `Estimado ${format(estimatedDate, "EEEE d", { locale: es })}`,
      subtitle: `Vence ${format(dueDate, "EEEE d", { locale: es })}`,
      tone: "estimated",
      priority: estimatedDelta,
    };
  }

  if (dueDelta <= 7) {
    return {
      id: `week-${occurrence.dueDate}`,
      title: isSameDay(dueDate, addDays(parseISO(today), 1))
        ? "Manana"
        : format(dueDate, "EEEE d", { locale: es }),
      subtitle: isWeekend(dueDate) ? "Vence en fin de semana" : "Esta semana",
      tone: "soon",
      priority: dueDelta,
    };
  }

  return {
    id: `later-${format(dueDate, "yyyy-MM")}`,
    title: format(dueDate, "MMMM yyyy", { locale: es }),
    subtitle: "Mas adelante",
    tone: "later",
    priority: dueDelta,
  };
}

export function buildTimelineSections(
  occurrences: ExpenseOccurrence[],
  today: string,
): TimelineSection[] {
  const sections = new Map<string, TimelineSection>();

  for (const occurrence of occurrences) {
    const meta = sectionMeta(occurrence, today);
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
    .sort((a, b) => {
      if (a.anchorDate !== b.anchorDate) return a.anchorDate.localeCompare(b.anchorDate);
      return a.priority - b.priority;
    });

  if (!timelineSections.some((section) => section.id === "today")) {
    timelineSections.push({
      id: "today",
      title: "Hoy",
      subtitle: "Punto de control",
      tone: "soon",
      priority: 0,
      total: 0,
      anchorDate: today,
      items: [],
    });
  }

  return timelineSections.sort((a, b) => {
    if (a.anchorDate !== b.anchorDate) return a.anchorDate.localeCompare(b.anchorDate);
    return a.priority - b.priority;
  });
}
