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
    blue: "bg-sky-100 text-sky-700",
    green: "bg-emerald-100 text-emerald-700",
    orange: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-700",
    violet: "bg-violet-100 text-violet-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];
}

export function statusLabel(occurrence: ExpenseOccurrence, today: string): string {
  if (occurrence.status === "paid") return "pagado";

  const delta = daysBetween(today, occurrence.dueDate);
  if (delta === 0) return "vence hoy";
  if (delta < 0) return `hace ${Math.abs(delta)} dias`;
  if (occurrence.estimatedChargeDate !== occurrence.dueDate) {
    return occurrence.estimatedChargeLabel;
  }
  return `en ${delta} dias`;
}
