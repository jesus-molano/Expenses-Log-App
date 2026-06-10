import type { ElementType } from "react";
import { CalendarDays, Check, Clock3, Sparkles } from "lucide-react";
import type { DraftExpense } from "@/domain/types";

export type TimelineHorizon = "today" | "week" | "month" | "paid";

export type HorizonDefinition = {
  label: string;
  description: string;
  icon: ElementType;
};

export const timelineHorizons: Record<TimelineHorizon, HorizonDefinition> = {
  today: {
    label: "Hoy",
    description: "Cobros de hoy",
    icon: Sparkles,
  },
  week: {
    label: "7 días",
    description: "Esta semana",
    icon: Clock3,
  },
  month: {
    label: "Mes",
    description: "Vista mensual",
    icon: CalendarDays,
  },
  paid: {
    label: "Pagados",
    description: "Pagos marcados",
    icon: Check,
  },
};

export function createEmptyDraft(): DraftExpense {
  return {
    name: "",
    description: "",
    amount: 1,
    categoryName: "General",
    tags: [],
    dueDay: new Date().getDate(),
    recurrence: { frequency: "monthly" },
  };
}
