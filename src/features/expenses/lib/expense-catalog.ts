import { addDays, addYears, parseISO, startOfMonth, subMonths } from "date-fns";
import { toDateOnly } from "@/domain/calendar";
import { commitmentStatus, type CommitmentStatus } from "@/domain/expense-details";
import { isOccurrenceOverdue } from "@/domain/pending";
import { generateOccurrences } from "@/domain/recurrence";
import { foldText, wordsOf } from "@/domain/text";
import type {
  AppLanguage,
  ExpenseOccurrence,
  ExpenseStore,
  ExpenseTemplate,
} from "@/domain/types";

export type CatalogStatusFilter = "active" | "finished" | "all";
export type CatalogFrequencyFilter = "all" | "monthly" | "quarterly" | "yearly" | "once" | "other";

export type CatalogFilters = {
  query: string;
  status: CatalogStatusFilter;
  frequency: CatalogFrequencyFilter;
  categoryId: string;
};

export const ALL_CATEGORIES = "all";

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  query: "",
  status: "active",
  frequency: "all",
  categoryId: ALL_CATEGORIES,
};

export type CatalogItem = {
  template: ExpenseTemplate;
  finished: boolean;
  // Fin de la serie (endDate) o fecha del gasto puntual ya pasado.
  finishedOn: string | null;
  // Próximo cobro desde hoy (sin contar los saltados).
  nextOccurrence: ExpenseOccurrence | null;
  // Cobro atrasado de este mes o el anterior.
  overdueOccurrence: ExpenseOccurrence | null;
  // Lo que suman sus cobros de los próximos 12 meses.
  yearlyCost: number;
  commitment: CommitmentStatus | null;
  // Nombre, descripción, notas, categoría y pago, plegados para buscar.
  searchText: string;
};

// Todas las series, activas y terminadas, con su próximo cobro y lo que
// cuestan al año. Las ocurrencias salen de las mismas reglas que el timeline.
export function buildExpenseCatalog({
  store,
  today,
  language = "es",
  categoryNameOf = () => "",
}: {
  store: ExpenseStore;
  today: string;
  language?: AppLanguage;
  // Nombre visible de una categoría, para poder buscar por ella.
  categoryNameOf?: (categoryId: string) => string;
}): CatalogItem[] {
  const todayDate = parseISO(today);
  const windowStart = toDateOnly(startOfMonth(subMonths(todayDate, 1)));
  const yearEnd = toDateOnly(addDays(addYears(todayDate, 1), -1));
  const byTemplate = new Map<string, ExpenseOccurrence[]>();
  for (const occurrence of generateOccurrences(
    store.templates,
    store.overrides,
    windowStart,
    yearEnd,
    language,
  )) {
    const list = byTemplate.get(occurrence.template.id) ?? [];
    list.push(occurrence);
    byTemplate.set(occurrence.template.id, list);
  }

  return store.templates
    .map((template) => {
      const occurrences = (byTemplate.get(template.id) ?? []).filter(
        (occurrence) => occurrence.status !== "skipped",
      );
      const upcoming = occurrences.filter((occurrence) => occurrence.dueDate >= today);
      const overdueOccurrence =
        occurrences.filter((occurrence) => isOccurrenceOverdue(occurrence, today)).at(-1) ??
        null;
      const endedByDate = Boolean(template.endDate && template.endDate < today);
      const oneOffPassed =
        template.recurrence.frequency === "once" &&
        template.startDate < today &&
        !overdueOccurrence;
      const finished = !template.active || endedByDate || oneOffPassed;

      return {
        template,
        finished,
        finishedOn: finished
          ? template.endDate ?? (template.recurrence.frequency === "once" ? template.startDate : null)
          : null,
        nextOccurrence: finished
          ? null
          : upcoming.find((occurrence) => occurrence.status === "due") ?? upcoming[0] ?? null,
        overdueOccurrence: finished ? null : overdueOccurrence,
        yearlyCost: finished
          ? 0
          : roundMoney(
              occurrences
                .filter((occurrence) => occurrence.occurrenceDate >= today)
                .reduce((sum, occurrence) => sum + occurrence.template.amount, 0),
            ),
        commitment: commitmentStatus(template.commitmentEndDate, today),
        searchText: foldText(
          [
            template.name,
            template.description,
            template.notes,
            template.paymentMethodDetail,
            categoryNameOf(template.categoryId),
          ]
            .filter(Boolean)
            .join(" "),
        ),
      } satisfies CatalogItem;
    })
    .sort(compareCatalogItems);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

// Primero lo atrasado, luego por próximo cobro; lo que no tiene ninguno y lo
// terminado, al final por nombre.
function compareCatalogItems(left: CatalogItem, right: CatalogItem) {
  const rank = (item: CatalogItem) =>
    item.finished ? 3 : item.overdueOccurrence ? 0 : item.nextOccurrence ? 1 : 2;
  if (rank(left) !== rank(right)) return rank(left) - rank(right);
  const leftDate = left.overdueOccurrence?.dueDate ?? left.nextOccurrence?.dueDate ?? "";
  const rightDate = right.overdueOccurrence?.dueDate ?? right.nextOccurrence?.dueDate ?? "";
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  return left.template.name.localeCompare(right.template.name, "es", { sensitivity: "base" });
}

export function frequencyGroup(template: ExpenseTemplate): Exclude<CatalogFrequencyFilter, "all"> {
  const { frequency } = template.recurrence;
  if (frequency === "monthly" || frequency === "quarterly" || frequency === "yearly" || frequency === "once") {
    return frequency;
  }
  return "other";
}

// Cada palabra buscada tiene que aparecer (sin tildes ni mayúsculas).
export function filterCatalog(items: CatalogItem[], filters: CatalogFilters): CatalogItem[] {
  const terms = wordsOf(foldText(filters.query));
  return items.filter((item) => {
    if (filters.status === "active" && item.finished) return false;
    if (filters.status === "finished" && !item.finished) return false;
    if (filters.frequency !== "all" && frequencyGroup(item.template) !== filters.frequency) {
      return false;
    }
    if (filters.categoryId !== ALL_CATEGORIES && item.template.categoryId !== filters.categoryId) {
      return false;
    }
    return terms.every((term) => item.searchText.includes(term));
  });
}

export function hasActiveCatalogFilters(filters: CatalogFilters) {
  return (
    filters.query.trim() !== "" ||
    filters.status !== DEFAULT_CATALOG_FILTERS.status ||
    filters.frequency !== DEFAULT_CATALOG_FILTERS.frequency ||
    filters.categoryId !== DEFAULT_CATALOG_FILTERS.categoryId
  );
}

export type CatalogSummary = {
  activeCount: number;
  yearlyTotal: number;
  // Media mensual de lo que cuesta al año (un anual reparte su importe).
  monthlyAverage: number;
};

export function summarizeCatalog(items: CatalogItem[]): CatalogSummary {
  const active = items.filter((item) => !item.finished);
  const yearlyTotal = roundMoney(active.reduce((sum, item) => sum + item.yearlyCost, 0));
  return {
    activeCount: active.length,
    yearlyTotal,
    monthlyAverage: roundMoney(yearlyTotal / 12),
  };
}

// Categorías que usa alguna serie, para el filtro.
export function catalogCategoryIds(items: CatalogItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.template.categoryId)));
}

// Series activas cuya permanencia acaba en los próximos días.
export function countEndingCommitments(items: CatalogItem[]) {
  return items.filter((item) => !item.finished && item.commitment?.kind === "ending").length;
}
