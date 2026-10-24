import { addDays, parseISO } from "date-fns";
import { periodStart } from "@/domain/budget-cycle";
import { activeBudgetMonth, addMonthId } from "@/domain/budget-month";
import { isValidDateOnly, toDateOnly } from "@/domain/calendar";
import {
  resumePausesOn,
  withAmountChange,
  withPause,
} from "@/domain/recurrence";
import {
  latestPaidChargeDate,
  seriesOccurrencesFrom,
} from "@/domain/series-lifecycle";
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

// Cambia el importe de la serie desde el mes activo (o el siguiente) sin
// reescribir lo pasado ni lo pagado (`keepAmountBeforeSeriesChange`). Los
// cambios de precio que empezaban antes dejan de aplicar desde ahí; los
// programados para más adelante se mantienen. Los meses siguen el ciclo del
// presupuesto: con el anclado al cobro, el mes empieza el día de cobro.
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

  const active = activeBudgetMonth(store.finance, toDateOnly(today));
  const from =
    scope === "next"
      ? periodStart(addMonthId(active.monthId, 1), active.cycle)
      : active.start;
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

// Reactiva una serie finalizada desde hoy, como al reanudar: el cobro de hoy y
// los siguientes vuelven. Los que habrían caído mientras estuvo terminada
// quedan tapados por una pausa ya pasada; si volvieran, saldrían como
// impagados en meses cerrados y se congelarían así en el historial.
export function reactivateSeriesInStore(
  store: ExpenseStore,
  templateId: string,
  today: Date = new Date(),
): ExpenseStore {
  const template = findTemplate(store, templateId);
  if (!template?.endDate) return store;

  const yesterday = toDateOnly(addDays(today, -1));
  const gapFrom = isValidDateOnly(template.endDate)
    ? toDateOnly(addDays(parseISO(template.endDate), 1))
    : null;
  return updateExpenseTemplateInStore(
    store,
    templateId,
    {
      endDate: undefined,
      ...(gapFrom && gapFrom <= yesterday
        ? { pauses: withPause(template.pauses, { from: gapFrom, to: yesterday }) }
        : {}),
    },
    today,
  );
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
