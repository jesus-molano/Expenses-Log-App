import { daysBetween } from "@/domain/calendar";
import { resolvePresetCategory } from "@/domain/categories";
import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import type {
  AppLanguage,
  DraftExpense,
  ExpenseCategory,
  ExpenseOccurrence,
  ExpenseStore,
  ExpenseTemplate,
} from "@/domain/types";
import { t } from "@/lib/i18n";

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
  const presetCategory = resolvePresetCategory(categoryName);
  const normalizedName = presetCategory.name;
  const existing = store.categories.find(
    (category) => category.name.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (existing) return { store, categoryId: existing.id };

  const category: ExpenseCategory = {
    id: createId("cat"),
    userId: "demo",
    name: normalizedName,
    icon: presetCategory.icon,
    tone: presetCategory.tone,
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
    name: draft.name.trim() || t("expenses.newExpense"),
    description: draft.description.trim(),
    amount: Number(draft.amount),
    currency: "EUR",
    categoryId,
    tags: draft.tags,
    startDate,
    endDate: draft.endDate || undefined,
    dueDay: draft.dueDay,
    recurrence: draft.recurrence,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function categoryToneClass(tone: ExpenseCategory["tone"]): string {
  return {
    blue: "app-chip app-chip-blue",
    green: "app-chip app-chip-green",
    orange: "app-chip app-chip-orange",
    rose: "app-chip app-chip-rose",
    violet: "app-chip app-chip-violet",
    slate: "app-chip app-chip-slate",
  }[tone];
}

export function statusLabel(
  occurrence: ExpenseOccurrence,
  today: string,
  language: AppLanguage = "es",
): string {
  if (occurrence.status === "paid") return t("expenses.statusPaid", language);

  const delta = daysBetween(today, occurrence.dueDate);
  if (delta === 0) return t("expenses.statusDueToday", language);
  if (delta < 0) {
    const days = Math.abs(delta);
    return language === "en"
      ? `${days} ${days === 1 ? t("expenses.day", language) : t("expenses.days", language)} ago`
      : `${t("expenses.daysAgo", language)} ${days} ${days === 1 ? t("expenses.day", language) : t("expenses.days", language)}`;
  }
  if (occurrence.estimatedChargeDate !== occurrence.dueDate) {
    const locale = language === "en" ? enUS : es;
    return `${t("expenses.estimated", language).toLowerCase()} ${format(
      parseISO(occurrence.estimatedChargeDate),
      "EEEE d",
      { locale },
    )}`;
  }
  return `${t("expenses.daysAhead", language)} ${delta} ${delta === 1 ? t("expenses.day", language) : t("expenses.days", language)}`;
}
