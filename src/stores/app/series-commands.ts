import { addDays, addMonths, endOfMonth, parseISO } from "date-fns";
import { addMonthId, resolveActiveMonth } from "@/domain/budget-month";
import { isValidDateOnly, toDateOnly } from "@/domain/calendar";
import { generateStoreOccurrences } from "@/domain/finance";
import { occurrenceKeyOf } from "@/domain/overrides";
import {
  resumePausesOn,
  withAmountChange,
  withPause,
} from "@/domain/recurrence";
import type {
  ExpenseAmountChange,
  ExpenseOccurrence,
  ExpensePause,
  ExpenseStore,
  ExpenseTemplate,
} from "@/domain/types";
import {
  keepAmountBeforeSeriesChange,
  updateExpenseTemplateInStore,
  type SeriesAmountScope,
} from "./expense-commands";
import { upsertOccurrenceOverride } from "./occurrence-overrides";

// Hasta dónde se buscan cobros pagados por adelantado al cambiar una serie.
const PREPAID_HORIZON_MONTHS = 13;

// Paga un cobro con lo que costó de verdad. Lo previsto no cambia: así se ve
// la diferencia en los recibos variables. Si ya estaba pagado, solo corrige
// el importe y conserva la fecha de pago.
export function payOccurrenceWithAmountInStore(
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
      amountPaid,
    },
    { now: now.toISOString() },
  );
}

// Cambia el importe de la serie desde el mes activo (o el siguiente) sin
// reescribir lo pasado ni lo pagado (`keepAmountBeforeSeriesChange`). Los
// cambios de precio que empezaban antes dejan de aplicar desde ahí; los
// programados para más adelante se mantienen.
export function setSeriesAmountInStore(
  store: ExpenseStore,
  templateId: string,
  amount: number,
  {
    scope = "current",
    today = new Date(),
  }: { scope?: SeriesAmountScope; today?: Date } = {},
): ExpenseStore {
  const template = findTemplate(store, templateId);
  if (!template || !Number.isFinite(amount) || amount <= 0) return store;

  const activeMonthId = resolveActiveMonth(
    toDateOnly(today),
    store.finance?.monthClosures,
  );
  const from = `${scope === "next" ? addMonthId(activeMonthId, 1) : activeMonthId}-01`;
  const kept = keepAmountBeforeSeriesChange(store, templateId, amount, {
    scope,
    today,
  });

  return updateExpenseTemplateInStore(
    kept,
    templateId,
    {
      amount,
      amountChanges: listOrUndefined(
        (template.amountChanges ?? []).filter((change) => change.from > from),
      ),
    },
    today,
  );
}

// Programa un precio desde una fecha ("desde marzo, 15 €"). Lo ya pagado de
// esas fechas conserva su importe.
export function scheduleAmountChangeInStore(
  store: ExpenseStore,
  templateId: string,
  change: ExpenseAmountChange,
  today: Date = new Date(),
): ExpenseStore {
  if (
    !findTemplate(store, templateId) ||
    !isValidDateOnly(change.from) ||
    !Number.isFinite(change.amount) ||
    change.amount <= 0
  ) {
    return store;
  }

  const kept = keepPaidAmountsFrom(store, templateId, change.from, today);
  return updateExpenseTemplateInStore(
    kept,
    templateId,
    {
      amountChanges: withAmountChange(
        findTemplate(kept, templateId)?.amountChanges,
        change,
      ),
    },
    today,
  );
}

// Quita un cambio de precio programado. Lo ya pagado conserva su importe.
export function removeAmountChangeInStore(
  store: ExpenseStore,
  templateId: string,
  from: string,
  today: Date = new Date(),
): ExpenseStore {
  const template = findTemplate(store, templateId);
  if (!template?.amountChanges?.some((change) => change.from === from)) {
    return store;
  }

  const kept = keepPaidAmountsFrom(store, templateId, from, today);
  return updateExpenseTemplateInStore(
    kept,
    templateId,
    {
      amountChanges: listOrUndefined(
        template.amountChanges.filter((change) => change.from !== from),
      ),
    },
    today,
  );
}

// Finaliza la serie tras su último cobro (incluido). Los cobros anteriores y
// lo ya pagado se conservan: nunca termina antes de un cobro pagado.
export function endSeriesInStore(
  store: ExpenseStore,
  templateId: string,
  lastChargeDate: string,
  today: Date = new Date(),
): ExpenseStore {
  if (!findTemplate(store, templateId) || !isValidDateOnly(lastChargeDate)) {
    return store;
  }

  const lastPaid = latestPaidChargeDate(store, templateId, today);
  const endDate = lastPaid && lastPaid > lastChargeDate ? lastPaid : lastChargeDate;
  return updateExpenseTemplateInStore(store, templateId, { endDate }, today);
}

export function reactivateSeriesInStore(
  store: ExpenseStore,
  templateId: string,
  today: Date = new Date(),
): ExpenseStore {
  if (!findTemplate(store, templateId)?.endDate) return store;
  return updateExpenseTemplateInStore(store, templateId, { endDate: undefined }, today);
}

// Pausa la serie entre dos fechas (sin fin, hasta reanudarla). La pausa nunca
// tapa un cobro ya pagado: empieza, como pronto, el día siguiente.
export function pauseSeriesInStore(
  store: ExpenseStore,
  templateId: string,
  pause: ExpensePause,
  today: Date = new Date(),
): ExpenseStore {
  const template = findTemplate(store, templateId);
  if (
    !template ||
    !isValidDateOnly(pause.from) ||
    (pause.to !== undefined && !isValidDateOnly(pause.to))
  ) {
    return store;
  }

  const lastPaid = latestPaidChargeDate(store, templateId, today);
  const from =
    lastPaid && lastPaid >= pause.from
      ? toDateOnly(addDays(parseISO(lastPaid), 1))
      : pause.from;
  if (pause.to !== undefined && pause.to < from) return store;

  return updateExpenseTemplateInStore(
    store,
    templateId,
    { pauses: withPause(template.pauses, { from, to: pause.to }) },
    today,
  );
}

// Reanuda hoy: el cobro de hoy y los siguientes vuelven. Las pausas futuras
// siguen programadas.
export function resumeSeriesInStore(
  store: ExpenseStore,
  templateId: string,
  today: Date = new Date(),
): ExpenseStore {
  const template = findTemplate(store, templateId);
  if (!template?.pauses?.length) return store;
  return updateExpenseTemplateInStore(
    store,
    templateId,
    { pauses: listOrUndefined(resumePausesOn(template.pauses, toDateOnly(today))) },
    today,
  );
}

export function removePauseInStore(
  store: ExpenseStore,
  templateId: string,
  from: string,
  today: Date = new Date(),
): ExpenseStore {
  const template = findTemplate(store, templateId);
  if (!template?.pauses?.some((pause) => pause.from === from)) return store;
  return updateExpenseTemplateInStore(
    store,
    templateId,
    {
      pauses: listOrUndefined(template.pauses.filter((pause) => pause.from !== from)),
    },
    today,
  );
}

// Fecha del último cobro pagado de la serie en los meses abiertos (también
// los adelantados): lo que una pausa o un final no deben tapar.
export function latestPaidChargeDate(
  store: ExpenseStore,
  templateId: string,
  today: Date = new Date(),
): string | null {
  return (
    seriesOccurrencesFrom(store, templateId, `${toDateOnly(today).slice(0, 7)}-01`, today)
      .filter((occurrence) => occurrence.status === "paid")
      .map((occurrence) => occurrence.occurrenceDate)
      .sort()
      .at(-1) ?? null
  );
}

// Fija el importe actual en los cobros ya pagados desde una fecha (incluidos
// los adelantados), para que un cambio de precio no reescriba lo pagado.
function keepPaidAmountsFrom(
  store: ExpenseStore,
  templateId: string,
  from: string,
  today: Date,
): ExpenseStore {
  const now = today.toISOString();
  return seriesOccurrencesFrom(store, templateId, from, today)
    .filter(
      (occurrence) =>
        occurrence.status === "paid" &&
        !occurrence.record &&
        occurrence.override?.amount === undefined,
    )
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

function seriesOccurrencesFrom(
  store: ExpenseStore,
  templateId: string,
  from: string,
  today: Date,
) {
  const start = parseISO(from) > today ? parseISO(from) : today;
  const to = toDateOnly(endOfMonth(addMonths(start, PREPAID_HORIZON_MONTHS)));
  return generateStoreOccurrences(store, from, to).filter(
    (occurrence) => occurrence.template.id === templateId,
  );
}

function findTemplate(
  store: ExpenseStore,
  templateId: string,
): ExpenseTemplate | undefined {
  return store.templates.find((template) => template.id === templateId);
}

function listOrUndefined<T>(items: T[]): T[] | undefined {
  return items.length ? items : undefined;
}

function keyOf(occurrence: ExpenseOccurrence) {
  return {
    templateId: occurrence.template.id,
    occurrenceDate: occurrence.occurrenceDate,
  };
}
