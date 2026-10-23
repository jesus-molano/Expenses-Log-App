import { endOfMonth, startOfMonth } from "date-fns";
import { addMonthId, resolveActiveMonth } from "@/domain/budget-month";
import { normalizeDateOnly, toDateOnly } from "@/domain/calendar";
import { generateStoreOccurrences } from "@/domain/finance";
import { occurrenceKeyOf, overrideIdFor } from "@/domain/overrides";
import {
  firstChargeAlreadyPassed,
  firstOccurrenceDate,
  generateOccurrences,
  passedChargeThisMonth,
  previousMonthsChargeDates,
  templateAmountOn,
} from "@/domain/recurrence";
import type {
  CreateExpenseOptions,
  DraftExpense,
  ExpenseOccurrence,
  ExpenseReminderSettings,
  ExpenseStore,
  ExpenseTemplate,
  PreviousChargesResolution,
} from "@/domain/types";
import {
  buildTemplateFromDraft,
  findOrCreateCategory,
} from "@/features/expenses/lib/expense-actions";
import {
  rekeyOverridesForTemplateChange,
  upsertOccurrenceOverride,
} from "./occurrence-overrides";
import type { MonthlyExpenseOverrideInput } from "./store-types";

export function addExpenseToStore(
  store: ExpenseStore,
  draft: DraftExpense,
  options: CreateExpenseOptions = {},
): ExpenseStore {
  const categoryResult = findOrCreateCategory(store, draft.categoryName);
  const startDate =
    normalizeDateOnly(draft.startDate) ?? toDateOnly(startOfMonth(new Date()));
  const template = buildTemplateFromDraft(
    normalizeDraftStartDate(draft, startDate),
    categoryResult.categoryId,
    startDate,
  );
  const today = toDateOnly(new Date());
  // El pago inicial va al cobro de este mes que ya pasó o, si no hay, al
  // primer cobro real (en un anual, su mes).
  const occurrenceDate =
    passedChargeThisMonth(template, today) ?? firstOccurrenceDate(template) ?? startDate;
  const now = new Date().toISOString();
  const initialOverrides =
    options.initialStatus === "paid"
      ? [
          {
            id: overrideIdFor({ templateId: template.id, occurrenceDate }),
            userId: "demo",
            templateId: template.id,
            occurrenceDate,
            status: "paid" as const,
            paidAt: now,
            amountPaid: templateAmountOn(template, occurrenceDate),
            updatedAt: now,
            statusUpdatedAt: now,
          },
        ]
      : [];

  const created: ExpenseStore = {
    ...categoryResult.store,
    templates: [...categoryResult.store.templates, template],
    overrides: [...categoryResult.store.overrides, ...initialOverrides],
  };

  return options.previousCharges
    ? resolvePreviousCharges(created, template, options.previousCharges, today)
    : created;
}

// Cobros de meses anteriores de un gasto recién creado con inicio pasado
// (M18): pagados, fechados el día de su cargo, o saltados. Sin esto quedarían
// como impagados en cada mes ya cerrado.
function resolvePreviousCharges(
  store: ExpenseStore,
  template: ExpenseTemplate,
  resolution: PreviousChargesResolution,
  today: string,
): ExpenseStore {
  const dates = previousMonthsChargeDates(template, today);
  if (!dates.length) return store;
  const occurrences = generateOccurrences(
    [template],
    store.overrides,
    dates[0],
    dates[dates.length - 1],
    store.preferences?.language,
  );

  return resolution === "paid"
    ? markOccurrencesPaidInStore(store, occurrences, {
        paidAt: (occurrence) => `${occurrence.estimatedChargeDate}T12:00:00.000Z`,
      })
    : skipOccurrencesInStore(store, occurrences);
}

function normalizeDraftStartDate(draft: DraftExpense, startDate: string): DraftExpense {
  if (draft.recurrence.frequency !== "yearly") return draft;
  if (draft.recurrence.annualMonth) return draft;

  return {
    ...draft,
    recurrence: {
      ...draft.recurrence,
      annualMonth: new Date(`${startDate}T00:00:00`).getMonth() + 1,
    },
  };
}

// Varios borradores de una captura, en un solo cambio del store. Solo los
// que tienen importe: uno sin él no es un gasto que se pueda guardar. "Ya
// pagado" solo se aplica a los que ya se cobraron este mes.
export function addExpensesToStore(
  store: ExpenseStore,
  drafts: DraftExpense[],
  options: CreateExpenseOptions = {},
): ExpenseStore {
  const today = toDateOnly(new Date());
  return drafts
    .filter((draft) => Number.isFinite(draft.amount) && draft.amount > 0)
    .reduce(
      (current, draft) =>
        addExpenseToStore(current, draft, {
          initialStatus:
            options.initialStatus === "paid" && firstChargeAlreadyPassed(draft, today)
              ? "paid"
              : "due",
          previousCharges: options.previousCharges,
        }),
      store,
    );
}

export function dismissLastChanceReminderInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  const now = new Date().toISOString();
  return upsertOccurrenceOverride(
    store,
    keyOf(occurrence),
    {
      reminderDismissedAt: now,
      reminderDismissedChargeDate: occurrence.estimatedChargeDate,
    },
    { defaults: { status: occurrence.status }, now },
  );
}

export function deleteExpenseFromStore(
  store: ExpenseStore,
  templateId: string,
): ExpenseStore {
  const templateOverrideIds = store.overrides
    .filter((override) => override.templateId === templateId)
    .map((override) => override.id);

  return {
    ...store,
    templates: store.templates.filter((template) => template.id !== templateId),
    overrides: store.overrides.filter(
      (override) => override.templateId !== templateId,
    ),
    deleted: {
      ...store.deleted,
      templates: mergeDeletedIds(store.deleted?.templates, [templateId]),
      overrides: mergeDeletedIds(store.deleted?.overrides, templateOverrideIds),
    },
  };
}

export function clearExpensesFromStore(store: ExpenseStore): ExpenseStore {
  return {
    ...store,
    categories: [],
    templates: [],
    overrides: [],
    deleted: {
      ...store.deleted,
      categories: mergeDeletedIds(
        store.deleted?.categories,
        store.categories.map((category) => category.id),
      ),
      templates: mergeDeletedIds(
        store.deleted?.templates,
        store.templates.map((template) => template.id),
      ),
      overrides: mergeDeletedIds(
        store.deleted?.overrides,
        store.overrides.map((override) => override.id),
      ),
    },
  };
}

// Pagado con otro importe: se apunta lo pagado; lo previsto del cobro y de la
// serie no cambia, y "Marcar como pendiente" lo deshace del todo. Si ya estaba
// pagado, solo corrige el importe y conserva la fecha de pago.
export function payOccurrenceInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  amountPaid: number,
  now: Date = new Date(),
): ExpenseStore {
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) return store;
  const key = keyOf(occurrence);
  const existing = store.overrides.find(
    (override) => occurrenceKeyOf(override) === occurrenceKeyOf(key),
  );
  const previousPaidAt =
    existing?.status === "paid"
      ? existing.paidAt
      : !existing && occurrence.record?.status === "paid"
        ? occurrence.record.paidAt
        : undefined;
  return upsertOccurrenceOverride(
    store,
    key,
    {
      status: "paid",
      paidAt: previousPaidAt ?? now.toISOString(),
      amountPaid: Math.round(amountPaid * 100) / 100,
    },
    { now: now.toISOString() },
  );
}

export function togglePaidInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  const now = new Date().toISOString();
  if (occurrence.status === "paid") {
    return upsertOccurrenceOverride(
      store,
      keyOf(occurrence),
      { status: "due", paidAt: undefined, amountPaid: undefined },
      { now },
    );
  }

  return upsertOccurrenceOverride(
    store,
    keyOf(occurrence),
    {
      status: "paid",
      paidAt: now,
      amountPaid: occurrence.template.amount,
    },
    { now },
  );
}

function mergeDeletedIds(
  current: string[] | undefined,
  next: string[],
): string[] {
  return Array.from(new Set([...(current ?? []), ...next]));
}

// Marca pagados varios cobros en un solo cambio del store; los que ya lo
// estaban no se tocan. `paidAt` permite fechar pagos atrasados.
export function markOccurrencesPaidInStore(
  store: ExpenseStore,
  occurrences: ExpenseOccurrence[],
  { paidAt }: { paidAt?: (occurrence: ExpenseOccurrence) => string } = {},
): ExpenseStore {
  const now = new Date().toISOString();
  return occurrences
    .filter((occurrence) => occurrence.status !== "paid")
    .reduce(
      (current, occurrence) =>
        upsertOccurrenceOverride(
          current,
          keyOf(occurrence),
          {
            status: "paid",
            paidAt: paidAt?.(occurrence) ?? now,
            amountPaid: occurrence.template.amount,
          },
          { now },
        ),
      store,
    );
}

export function skipOccurrencesInStore(
  store: ExpenseStore,
  occurrences: ExpenseOccurrence[],
): ExpenseStore {
  const now = new Date().toISOString();
  return occurrences
    .filter((occurrence) => occurrence.status !== "skipped")
    .reduce(
      (current, occurrence) =>
        upsertOccurrenceOverride(current, keyOf(occurrence), { status: "skipped" }, { now }),
      store,
    );
}

export function skipOccurrenceInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  return upsertOccurrenceOverride(store, keyOf(occurrence), {
    status: "skipped",
  });
}

export function restoreOccurrenceInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
): ExpenseStore {
  return upsertOccurrenceOverride(store, keyOf(occurrence), { status: "due" });
}

export function moveOccurrenceInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  dueDate: string,
  sortOrder?: number,
): ExpenseStore {
  return upsertOccurrenceOverride(
    store,
    keyOf(occurrence),
    {
      dueDate: dueDate === occurrence.occurrenceDate ? undefined : dueDate,
      sortOrder,
    },
    { defaults: { status: occurrence.status } },
  );
}

export function moveOccurrenceOnlyInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  dueDate: string,
  sortOrder?: number,
): ExpenseStore {
  // Una ocurrencia de un mes cerrado lleva una plantilla sintética: su dueDay
  // no es el de la serie y no debe escribirse en ella.
  if (occurrence.record) {
    return moveOccurrenceInStore(store, occurrence, dueDate, sortOrder);
  }

  // Tras arrastrar se aplica el cambio de serie y se pregunta: "solo este mes"
  // lo deshace con el mismo rekey, para devolver pagos y ediciones a su fecha.
  const restoredSeriesStore = updateExpenseTemplateInStore(
    store,
    occurrence.template.id,
    { dueDay: occurrence.template.dueDay },
  );

  return moveOccurrenceInStore(restoredSeriesStore, occurrence, dueDate, sortOrder);
}

export function moveOccurrenceSeriesInStore(
  store: ExpenseStore,
  occurrence: ExpenseOccurrence,
  dueDate: string,
): ExpenseStore {
  const day = new Date(`${dueDate}T00:00:00`).getDate();
  const key = { templateId: occurrence.template.id, occurrenceDate: dueDate };
  const moved = updateExpenseTemplateInStore(store, key.templateId, {
    dueDay: day,
  });

  // Si este cobro ya estaba movido, el rekey le conserva la fecha anterior:
  // tiene que caer donde se soltó.
  const landed = moved.overrides.find(
    (override) => occurrenceKeyOf(override) === occurrenceKeyOf(key),
  );
  return landed?.dueDate
    ? upsertOccurrenceOverride(moved, key, { dueDate: undefined })
    : moved;
}

// Desde cuándo vale un importe nuevo de la serie.
export type SeriesAmountScope = "current" | "next";

// Antes de cambiar el importe de una serie, lo que ya pasó o ya está pagado
// conserva el importe anterior: los meses anteriores al del calendario ya son
// registros, y aquí se fijan con un override los cobros de un mes cerrado con
// "Pasar al mes siguiente", los ya pagados (también los adelantados del mes
// que viene) y, si el cambio vale desde el mes que viene, los del mes activo.
// Cada cobro conserva el importe que tenía (con sus cambios de precio
// programados) y solo se fija si el nuevo lo cambiaría.
export function keepAmountBeforeSeriesChange(
  store: ExpenseStore,
  templateId: string,
  nextAmount: number,
  { scope = "current", today = new Date() }: { scope?: SeriesAmountScope; today?: Date } = {},
): ExpenseStore {
  const template = store.templates.find((item) => item.id === templateId);
  if (!template) return store;

  const todayId = toDateOnly(today);
  const activeMonthId = resolveActiveMonth(todayId, store.finance?.monthClosures);
  const from = `${todayId.slice(0, 7)}-01`;
  const to = toDateOnly(endOfMonth(new Date(`${addMonthId(activeMonthId, 1)}-01T00:00:00`)));
  const now = today.toISOString();

  return generateStoreOccurrences(store, from, to)
    .filter(
      (occurrence) =>
        occurrence.template.id === templateId &&
        !occurrence.record &&
        occurrence.override?.amount === undefined &&
        occurrence.template.amount !== nextAmount,
    )
    .filter((occurrence) => {
      const monthId = occurrence.dueDate.slice(0, 7);
      return (
        occurrence.status === "paid" ||
        monthId < activeMonthId ||
        (scope === "next" && monthId === activeMonthId)
      );
    })
    .reduce(
      (current, occurrence) =>
        upsertOccurrenceOverride(
          current,
          keyOf(occurrence),
          { amount: occurrence.template.amount },
          { defaults: { status: occurrence.status }, now },
        ),
      store,
    );
}

// Cambia la serie y recoloca los overrides de los meses abiertos si cambia su
// calendario, para que el pago o el movimiento de este mes no se pierda.
export function updateExpenseTemplateInStore(
  store: ExpenseStore,
  templateId: string,
  changes: Partial<Omit<ExpenseTemplate, "id" | "userId" | "createdAt">>,
  today: Date = new Date(),
): ExpenseStore {
  const previous = store.templates.find((template) => template.id === templateId);
  if (!previous) return store;

  const next: ExpenseTemplate = {
    ...previous,
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  return rekeyOverridesForTemplateChange(
    {
      ...store,
      templates: store.templates.map((template) =>
        template.id === templateId ? next : template,
      ),
    },
    previous,
    next,
    today,
  );
}

// Aviso propio de un gasto (la campana de la fila). undefined lo devuelve al
// aviso por defecto de Ajustes.
export function setTemplateReminderInStore(
  store: ExpenseStore,
  templateId: string,
  reminder: ExpenseReminderSettings | undefined,
): ExpenseStore {
  return updateExpenseTemplateInStore(store, templateId, { reminder });
}

export function updateMonthlyExpenseOccurrenceInStore(
  store: ExpenseStore,
  input: MonthlyExpenseOverrideInput,
): ExpenseStore {
  const categoryResult = input.categoryName
    ? findOrCreateCategory(store, input.categoryName)
    : { store, categoryId: input.categoryId ?? "" };
  const existing = store.overrides.find(
    (override) =>
      override.templateId === input.templateId &&
      override.occurrenceDate === input.occurrenceDate,
  );
  const now = new Date().toISOString();
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return store;
  // Lo pagado puede diferir de lo previsto; sin dato, se pagó lo previsto.
  const amountPaid =
    input.amountPaid !== undefined && Number.isFinite(input.amountPaid) && input.amountPaid > 0
      ? input.amountPaid
      : amount;

  return upsertOccurrenceOverride(
    categoryResult.store,
    { templateId: input.templateId, occurrenceDate: input.occurrenceDate },
    {
      dueDate: input.dueDate === input.occurrenceDate ? undefined : input.dueDate,
      status: input.status,
      name: input.name.trim(),
      amount,
      categoryId: categoryResult.categoryId,
      paidAt: input.status === "paid" ? existing?.paidAt ?? now : undefined,
      amountPaid: input.status === "paid" ? amountPaid : undefined,
    },
    { now },
  );
}

function keyOf(occurrence: ExpenseOccurrence) {
  return {
    templateId: occurrence.template.id,
    occurrenceDate: occurrence.occurrenceDate,
  };
}
