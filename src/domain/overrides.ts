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

// Gana el cambio más reciente; si empatan (o faltan fechas), el estado más
// definitivo, para no volver a pedir un pago ya hecho.
export function pickWinningOverride(
  a: ExpenseOccurrenceOverride,
  b: ExpenseOccurrenceOverride,
): ExpenseOccurrenceOverride {
  const aUpdated = a.updatedAt ?? "";
  const bUpdated = b.updatedAt ?? "";
  if (aUpdated !== bUpdated) return aUpdated > bUpdated ? a : b;
  return (STATUS_RANK[b.status] ?? 0) > (STATUS_RANK[a.status] ?? 0) ? b : a;
}

// Deja un override por clave con el id determinista. Los ids borrados se
// filtran antes de reescribir, porque los tombstones guardan el id original.
export function dedupeOverrides(
  overrides: ExpenseOccurrenceOverride[],
  deletedIds: string[] = [],
): ExpenseOccurrenceOverride[] {
  const deleted = new Set(deletedIds);
  const byKey = new Map<string, ExpenseOccurrenceOverride>();

  const incomplete: ExpenseOccurrenceOverride[] = [];

  for (const override of overrides) {
    if (deleted.has(override.id)) continue;
    if (
      typeof override.templateId !== "string" ||
      typeof override.occurrenceDate !== "string"
    ) {
      incomplete.push(override);
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
    ...incomplete,
  ];
}
