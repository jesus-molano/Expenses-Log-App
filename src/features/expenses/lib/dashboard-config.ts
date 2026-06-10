import type { ElementType } from "react";
import { Bell, CalendarClock, Check, WalletCards } from "lucide-react";
import type { DraftExpense } from "@/domain/types";

export type SmartList = "today" | "upcoming" | "all" | "paid";

export type SmartListDefinition = {
  label: string;
  description: string;
  icon: ElementType;
};

export const smartLists: Record<SmartList, SmartListDefinition> = {
  today: {
    label: "Hoy",
    description: "Vencen o pueden cobrarse hoy",
    icon: Bell,
  },
  upcoming: {
    label: "Proximos",
    description: "30 dias vista",
    icon: CalendarClock,
  },
  all: {
    label: "Todos",
    description: "Gastos activos",
    icon: WalletCards,
  },
  paid: {
    label: "Realizados",
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
