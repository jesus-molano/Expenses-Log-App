import { endOfMonth, parseISO, startOfMonth } from "date-fns";
import { toDateOnly } from "@/domain/calendar";
import {
  isNeutralOverride,
  NO_STATUS_DECISION,
  occurrenceKeyOf,
  overrideIdFor,
  pickWinningOverride,
  statusChangedBetween,
  type OccurrenceKey,
} from "@/domain/overrides";
import { generateTemplateDates } from "@/domain/recurrence";
import type {
  ExpenseOccurrenceOverride,
  ExpenseStore,
  ExpenseTemplate,
  OccurrenceStatus,
} from "@/domain/types";

type OverridePatch = Partial<
  Omit<ExpenseOccurrenceOverride, "id" | "userId" | "templateId" | "occurrenceDate">
>;

const STATUS_RANK: Record<OccurrenceStatus, number> = { due: 0, skipped: 1, paid: 2 };

// Aplica un cambio a la ocurrencia conservando el resto de sus campos. Nunca
// borra overrides: un borrado se perdería al fusionar con otro dispositivo.
export function upsertOccurrenceOverride(
  store: ExpenseStore,
  key: OccurrenceKey,
  patch: OverridePatch,
  {
    defaults = {},
    now = new Date().toISOString(),
  }: { defaults?: OverridePatch; now?: string } = {},
): ExpenseStore {
  const keyId = occurrenceKeyOf(key);
  const id = overrideIdFor(key);
  const matches = store.overrides.filter(
    (override) => occurrenceKeyOf(override) === keyId,
  );
  const existing = matches.reduce<ExpenseOccurrenceOverride | undefined>(
    (winner, override) =>
      winner ? pickWinningOverride(winner, override) : override,
    undefined,
  );
  const fields = { status: "due" as const, ...defaults, ...existing, ...patch };
  const next: ExpenseOccurrenceOverride = {
    ...fields,
    id,
    userId: existing?.userId ?? "demo",
    templateId: key.templateId,
    occurrenceDate: key.occurrenceDate,
    updatedAt: now,
    statusUpdatedAt: statusChangedBetween(existing, fields)
      ? now
      : existing?.statusUpdatedAt ?? existing?.updatedAt ?? NO_STATUS_DECISION,
  };

  return {
    ...store,
    overrides: [
      ...store.overrides.filter((override) => occurrenceKeyOf(override) !== keyId),
      next,
    ],
    deleted: withReplacedIds(
      store.deleted,
      matches.map((override) => override.id).filter((matchId) => matchId !== id),
    ),
  };
}

function withReplacedIds(
  deleted: ExpenseStore["deleted"],
  replacedIds: string[],
): ExpenseStore["deleted"] {
  if (!replacedIds.length) return deleted;
  return {
    ...deleted,
    overrides: Array.from(new Set([...(deleted?.overrides ?? []), ...replacedIds])),
  };
}

// Cuando cambia el calendario de una serie (día de cobro, inicio o
// recurrencia), mueve los overrides de los meses abiertos a la nueva fecha de
// ese mes para no perder pagos ni movimientos. La clave antigua queda neutra.
export function rekeyOverridesForTemplateChange(
  store: ExpenseStore,
  previous: ExpenseTemplate,
  next: ExpenseTemplate,
  today: Date = new Date(),
): ExpenseStore {
  if (!scheduleChanged(previous, next)) return store;
  return rekeyOpenOverrides(store, next, today);
}

// El rekey de un cambio de día solo corre en el dispositivo que edita: un pago
// hecho en otro con la fecha antigua queda, al fusionar, en una clave que la
// plantilla ya no genera. Repite el rekey de los meses abiertos contra las
// plantillas actuales. Devuelve el mismo store si no había nada que mover.
export function reconcileOrphanOverrides(
  store: ExpenseStore,
  today: Date = new Date(),
): ExpenseStore {
  const openFrom = openMonthsFrom(today);
  const candidates = new Set(
    store.overrides
      .filter(
        (override) =>
          override.occurrenceDate >= openFrom && !isNeutralOverride(override),
      )
      .map((override) => override.templateId),
  );
  if (!candidates.size) return store;

  return store.templates
    .filter((template) => candidates.has(template.id))
    .reduce((result, template) => rekeyOpenOverrides(result, template, today), store);
}

function openMonthsFrom(today: Date) {
  return toDateOnly(startOfMonth(today));
}

// Lleva cada override de un mes abierto de la serie a la única fecha que la
// plantilla genera en ese mes; si choca, gana el estado más definitivo.
function rekeyOpenOverrides(
  store: ExpenseStore,
  template: ExpenseTemplate,
  today: Date,
): ExpenseStore {
  const openFrom = openMonthsFrom(today);
  const now = new Date().toISOString();
  let result = store;

  for (const override of store.overrides) {
    if (
      override.templateId !== template.id ||
      override.occurrenceDate < openFrom ||
      isNeutralOverride(override)
    ) {
      continue;
    }
    const month = parseISO(override.occurrenceDate);
    const [target, ...others] = generateTemplateDates(
      template,
      toDateOnly(startOfMonth(month)),
      toDateOnly(endOfMonth(month)),
    );
    if (!target || others.length || target === override.occurrenceDate) continue;

    const targetExisting = result.overrides.find(
      (candidate) =>
        candidate.templateId === template.id && candidate.occurrenceDate === target,
    );
    // Un placeholder neutro en el destino no protege nada: el contenido de la
    // clave antigua pasa a la nueva salvo que el destino tenga un estado más
    // definitivo.
    if (
      !targetExisting ||
      isNeutralOverride(targetExisting) ||
      STATUS_RANK[override.status] > STATUS_RANK[targetExisting.status]
    ) {
      const { dueDate, ...fields } = override;
      result = upsertOccurrenceOverride(
        result,
        { templateId: template.id, occurrenceDate: target },
        { ...fields, dueDate: dueDate === target ? undefined : dueDate },
        { now },
      );
    }
    result = neutralizeOverride(result, override, now);
  }

  return result;
}

function neutralizeOverride(
  store: ExpenseStore,
  key: OccurrenceKey,
  now: string,
): ExpenseStore {
  const keyId = occurrenceKeyOf(key);
  const existing = store.overrides.find(
    (override) => occurrenceKeyOf(override) === keyId,
  );
  return {
    ...store,
    overrides: [
      ...store.overrides.filter((override) => occurrenceKeyOf(override) !== keyId),
      {
        id: overrideIdFor(key),
        userId: existing?.userId ?? "demo",
        templateId: key.templateId,
        occurrenceDate: key.occurrenceDate,
        status: "due",
        updatedAt: now,
        statusUpdatedAt: now,
      },
    ],
  };
}

function scheduleChanged(previous: ExpenseTemplate, next: ExpenseTemplate) {
  return (
    previous.dueDay !== next.dueDay ||
    previous.startDate !== next.startDate ||
    JSON.stringify(previous.recurrence) !== JSON.stringify(next.recurrence)
  );
}
