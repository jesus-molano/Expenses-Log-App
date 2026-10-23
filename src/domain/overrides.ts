import type { ExpenseOccurrenceOverride, OccurrenceStatus } from "./types";

export type OccurrenceKey = Pick<
  ExpenseOccurrenceOverride,
  "templateId" | "occurrenceDate"
>;

// Un override por ocurrencia: el id se deriva de la clave para que dos
// dispositivos que editan la misma ocurrencia no creen dos overrides.
export function overrideIdFor({ templateId, occurrenceDate }: OccurrenceKey) {
  return `ovr:${templateId}:${occurrenceDate}`;
}

export function occurrenceKeyOf({ templateId, occurrenceDate }: OccurrenceKey) {
  return `${templateId}:${occurrenceDate}`;
}

const STATUS_RANK: Record<OccurrenceStatus, number> = {
  due: 0,
  skipped: 1,
  paid: 2,
};

// Un override creado para otra cosa (mover, posponer un aviso…) no ha decidido
// nada sobre el estado: no debe pisar un pago hecho en otro dispositivo.
export const NO_STATUS_DECISION = "1970-01-01T00:00:00.000Z";

const STATUS_FIELDS = ["status", "paidAt", "amountPaid"] as const;

const DATA_FIELDS = [
  "dueDate",
  "sortOrder",
  "name",
  "amount",
  "categoryId",
  "paidAt",
  "amountPaid",
  "note",
  "reminderDismissedAt",
  "reminderDismissedChargeDate",
] as const;

// Override que no cambia nada de la ocurrencia: lo que queda en una clave
// tras deshacer, restaurar o mover su contenido a otra fecha.
export function isNeutralOverride(override: ExpenseOccurrenceOverride) {
  return (
    override.status === "due" &&
    DATA_FIELDS.every((field) => override[field] === undefined)
  );
}

// Compara qué versión cambió algo más tarde; si empatan (o faltan fechas),
// gana el estado más definitivo, para no volver a pedir un pago ya hecho, y
// después la segunda (la local al fusionar, como en el resto del merge).
function laterOf(
  a: ExpenseOccurrenceOverride,
  b: ExpenseOccurrenceOverride,
  changedAt: (override: ExpenseOccurrenceOverride) => string,
) {
  const aChanged = changedAt(a);
  const bChanged = changedAt(b);
  if (aChanged !== bChanged) return aChanged > bChanged ? a : b;
  return (STATUS_RANK[a.status] ?? 0) > (STATUS_RANK[b.status] ?? 0) ? a : b;
}

export function statusChangedBetween(
  previous: Partial<ExpenseOccurrenceOverride> | undefined,
  next: Partial<ExpenseOccurrenceOverride>,
) {
  const before = previous ?? { status: "due" };
  return STATUS_FIELDS.some((field) => before[field] !== next[field]);
}

// Fusiona dos versiones de la misma ocurrencia: el estado viene de la que lo
// cambió más tarde y el resto de campos de la última edición. Así mover un
// cobro o posponer su aviso en un dispositivo desactualizado no deshace un
// pago hecho en otro.
export function pickWinningOverride(
  a: ExpenseOccurrenceOverride,
  b: ExpenseOccurrenceOverride,
): ExpenseOccurrenceOverride {
  const latest = laterOf(a, b, (override) => override.updatedAt ?? "");
  const statusSource = laterOf(
    a,
    b,
    (override) => override.statusUpdatedAt ?? override.updatedAt ?? "",
  );
  if (latest === statusSource) return latest;

  return {
    ...latest,
    status: statusSource.status,
    paidAt: statusSource.paidAt,
    amountPaid: statusSource.amountPaid,
    statusUpdatedAt:
      statusSource.statusUpdatedAt ?? statusSource.updatedAt ?? NO_STATUS_DECISION,
  };
}

// Deja un override por clave con el id determinista. Los ids borrados se
// filtran antes de reescribir, porque los tombstones guardan el id original.
export function dedupeOverrides(
  overrides: ExpenseOccurrenceOverride[],
  deletedIds: string[] = [],
): ExpenseOccurrenceOverride[] {
  const deleted = new Set(deletedIds);
  const byKey = new Map<string, ExpenseOccurrenceOverride>();
  const incomplete = new Map<string, ExpenseOccurrenceOverride>();

  for (const override of overrides) {
    if (deleted.has(override.id)) continue;
    if (
      typeof override.templateId !== "string" ||
      typeof override.occurrenceDate !== "string"
    ) {
      incomplete.set(override.id ?? `incomplete:${incomplete.size}`, override);
      continue;
    }
    const key = occurrenceKeyOf(override);
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickWinningOverride(existing, override) : override);
  }

  return [
    ...Array.from(byKey.values(), (override) => {
      const id = overrideIdFor(override);
      return override.id === id ? override : { ...override, id };
    }),
    ...incomplete.values(),
  ];
}
