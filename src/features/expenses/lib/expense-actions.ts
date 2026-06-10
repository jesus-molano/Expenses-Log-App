import { daysBetween } from "@/domain/calendar";
import type {
  DraftExpense,
  ExpenseCategory,
  ExpenseOccurrence,
  ExpenseStore,
  ExpenseTemplate,
} from "@/domain/types";

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function normalizeTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

export function findOrCreateCategory(
  store: ExpenseStore,
  categoryName: string,
): { store: ExpenseStore; categoryId: string } {
  const normalizedName = categoryName.trim() || "General";
  const existing = store.categories.find(
    (category) => category.name.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (existing) return { store, categoryId: existing.id };

  const category: ExpenseCategory = {
    id: createId("cat"),
    userId: "demo",
    name: normalizedName,
    icon: "WalletCards",
    tone: "slate",
  };

  return {
    categoryId: category.id,
    store: {
      ...store,
      categories: [...store.categories, category],
    },
  };
}

export function buildTemplateFromDraft(
  draft: DraftExpense,
  categoryId: string,
  startDate: string,
): ExpenseTemplate {
  const now = new Date().toISOString();

  return {
    id: createId("exp"),
    userId: "demo",
    name: draft.name.trim() || "Nuevo gasto",
    description: draft.description.trim(),
    amount: Number(draft.amount),
    currency: "EUR",
    categoryId,
    tags: draft.tags,
    startDate,
    dueDay: draft.dueDay,
    recurrence: draft.recurrence,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function categoryToneClass(tone: ExpenseCategory["tone"]): string {
  return {
    blue: "bg-cyan-300/18 text-cyan-100 ring-1 ring-cyan-200/35",
    green: "bg-lime-300/18 text-lime-100 ring-1 ring-lime-200/35",
    orange: "bg-orange-400/18 text-orange-100 ring-1 ring-orange-200/35",
    rose: "bg-rose-400/18 text-rose-100 ring-1 ring-rose-200/35",
    violet: "bg-violet-400/18 text-violet-100 ring-1 ring-violet-200/35",
    slate: "bg-white/12 text-slate-100 ring-1 ring-white/15",
  }[tone];
}

export function statusLabel(occurrence: ExpenseOccurrence, today: string): string {
  if (occurrence.status === "paid") return "pagado";

  const delta = daysBetween(today, occurrence.dueDate);
  if (delta === 0) return "vence hoy";
  if (delta < 0) return `hace ${Math.abs(delta)} días`;
  if (occurrence.estimatedChargeDate !== occurrence.dueDate) {
    return occurrence.estimatedChargeLabel;
  }
  return `en ${delta} días`;
}
