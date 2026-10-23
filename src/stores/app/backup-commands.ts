import {
  emptyFinanceStore,
  getSalaryExtraPaySettings,
  materializeClosedOccurrenceRecords,
  salaryClearedTombstone,
} from "@/domain/finance";
import { occurrenceKeyOf, overrideIdFor } from "@/domain/overrides";
import type {
  BalanceCheckin,
  BudgetCycleSetting,
  ExpenseOccurrenceOverride,
  ExpenseStore,
  FinanceStore,
  MonthClosure,
  SalaryExtraPaySettings,
  SalaryReceipt,
} from "@/domain/types";
import { mergeExpenseStores } from "@/data/persistence/local-store";
import {
  normalizeExpenseStore,
  withNonEmpty,
} from "@/data/persistence/store-normalization";

export type ImportMode = "merge" | "replace";
// "all": el archivo trae el store entero (JSON, copias). "expenses": solo
// gastos, cobros e histórico (CSV); Plan, ingresos y preferencias se quedan.
export type ImportScope = "all" | "expenses";

export function importStoreInStore(
  current: ExpenseStore,
  imported: ExpenseStore,
  {
    mode,
    scope,
    now = new Date(),
  }: { mode: ImportMode; scope: ImportScope; now?: Date },
): ExpenseStore {
  if (mode === "replace") return replaceStoreContents(current, imported, { scope, now });

  // Combinar es fusionar como con la nube: por id gana la versión más
  // reciente, los borrados de cualquiera de los dos siguen borrados y las
  // preferencias del dispositivo se mantienen.
  const incoming =
    scope === "all"
      ? imported
      : { ...imported, finance: emptyFinanceStore, preferences: current.preferences };
  return mergeExpenseStores(current, incoming);
}

// Sustituye los datos por los del archivo de forma que aguante una fusión
// posterior con la nube o con otro dispositivo (si la subida falla o hay otro
// dispositivo sin sincronizar):
// - Todo lo importado se marca como editado ahora, para ganar a las versiones
//   anteriores de la nube.
// - Lo que solo estaba en los datos actuales se borra con tombstone si su id
//   es aleatorio (gastos, categorías, ingresos, aportaciones, histórico de
//   gastos que desaparecen) o se deja en estado neutro si es determinista
//   (cobros, cierres de mes, respuestas a "¿Has cobrado?", sueldos, pagas
//   extra), porque un tombstone de un id determinista bloquearía para siempre
//   volver a usarlo.
// - Los objetivos de ahorro no tienen tombstone: un mes que solo estaba en los
//   datos actuales podría volver en esa fusión.
// Las preferencias (tema e idioma) son del dispositivo y no se tocan.
export function replaceStoreContents(
  current: ExpenseStore,
  imported: ExpenseStore,
  { scope, now = new Date() }: { scope: ImportScope; now?: Date },
): ExpenseStore {
  const stamp = now.toISOString();
  // Las categorías también: una copia antigua sin fecha perdería frente a la
  // versión con fecha de la nube (`latestUpdated`).
  const categories = imported.categories.map((category) => ({ ...category, updatedAt: stamp }));
  const templates = imported.templates.map((template) => ({ ...template, updatedAt: stamp }));
  const templateIds = new Set(templates.map((template) => template.id));
  const overrides = replaceOverrides(current.overrides, imported.overrides, templateIds, stamp);
  const finance = scope === "all" ? replaceFinance(current.finance, imported.finance, stamp) : current.finance;
  const base: ExpenseStore = {
    ...(scope === "all" ? imported : current),
    schemaVersion: 3,
    categories,
    templates,
    overrides,
    occurrenceRecords: imported.occurrenceRecords ?? [],
    finance,
    preferences: current.preferences,
  };
  // El histórico de los meses cerrados sale de los datos importados y queda
  // como editado ahora, para que no lo pise el que se recalcula de los
  // actuales al guardar (`preserveClosedOccurrenceRecords`).
  const occurrenceRecords = (
    materializeClosedOccurrenceRecords(base, { today: now }).occurrenceRecords ?? []
  ).map((record) => ({ ...record, updatedAt: stamp }));
  const currentRecordIds = (
    materializeClosedOccurrenceRecords(current, { today: now }).occurrenceRecords ?? []
  ).map((record) => record.id);

  const kept = {
    categories: ids(categories),
    templates: templateIds,
    overrides: ids(overrides),
    occurrenceRecords: ids(occurrenceRecords),
    incomeEvents: ids(finance.incomeEvents),
    savingsContributions: ids(Object.values(finance.monthlySavingsContributions ?? {})),
  };
  const removedTemplateOverrides = current.overrides
    .filter((override) => !templateIds.has(override.templateId))
    .map((override) => override.id);
  const deleted = current.deleted ?? {};
  const importedDeleted = scope === "all" ? (imported.deleted ?? {}) : {};
  const tombstones = (
    key: keyof typeof kept,
    removed: string[],
  ): string[] =>
    Array.from(
      new Set([...(deleted[key] ?? []), ...(importedDeleted[key] ?? []), ...removed]),
    ).filter((id) => !kept[key].has(id));

  return normalizeExpenseStore(
    {
      ...base,
      occurrenceRecords,
      deleted: {
        ...deleted,
        ...importedDeleted,
        categories: tombstones("categories", current.categories.map((category) => category.id)),
        templates: tombstones("templates", current.templates.map((template) => template.id)),
        overrides: tombstones("overrides", removedTemplateOverrides),
        occurrenceRecords: tombstones("occurrenceRecords", currentRecordIds),
        incomeEvents:
          scope === "all"
            ? tombstones("incomeEvents", current.finance.incomeEvents.map((event) => event.id))
            : (deleted.incomeEvents ?? []),
        savingsContributions:
          scope === "all"
            ? tombstones(
                "savingsContributions",
                Object.values(current.finance.monthlySavingsContributions ?? {}).map(
                  (contribution) => contribution.id,
                ),
              )
            : (deleted.savingsContributions ?? []),
        monthlySalary: Array.from(
          new Set([
            ...(deleted.monthlySalary ?? []),
            ...(importedDeleted.monthlySalary ?? []),
            ...(scope === "all"
              ? Object.keys(current.finance.monthlySalary)
                  .filter((monthId) => !(monthId in imported.finance.monthlySalary))
                  .map((monthId) => salaryClearedTombstone(stamp, monthId))
              : []),
          ]),
        ),
      },
    },
    now,
  );
}

function replaceOverrides(
  current: ExpenseOccurrenceOverride[],
  imported: ExpenseOccurrenceOverride[],
  templateIds: Set<string>,
  stamp: string,
): ExpenseOccurrenceOverride[] {
  const importedKeys = new Set(imported.map(occurrenceKeyOf));
  const neutral = current
    .filter(
      (override) =>
        templateIds.has(override.templateId) && !importedKeys.has(occurrenceKeyOf(override)),
    )
    .map((override) => ({
      id: overrideIdFor(override),
      userId: override.userId,
      templateId: override.templateId,
      occurrenceDate: override.occurrenceDate,
      status: "due" as const,
      updatedAt: stamp,
      statusUpdatedAt: stamp,
    }));
  return [
    ...imported.map((override) => ({ ...override, updatedAt: stamp, statusUpdatedAt: stamp })),
    ...neutral,
  ];
}

function replaceFinance(
  current: FinanceStore,
  imported: FinanceStore,
  stamp: string,
): FinanceStore {
  const restamp = <T extends object>(record: Record<string, T> | undefined) =>
    Object.fromEntries(
      Object.entries(record ?? {}).map(([monthId, value]) => [
        monthId,
        { ...value, updatedAt: stamp },
      ]),
    ) as Record<string, T & { updatedAt: string }>;
  const closures: Record<string, MonthClosure> = {
    // Un cierre que solo estaba en los datos actuales se reabre en lugar de
    // borrarse: el merge por mes se quedaría con él.
    ...Object.fromEntries(
      Object.entries(current.monthClosures ?? {})
        .filter(([monthId]) => !imported.monthClosures?.[monthId])
        .map(([monthId, closure]) => [
          monthId,
          { ...closure, reopenedAt: stamp, updatedAt: stamp },
        ]),
    ),
    ...restamp(imported.monthClosures),
  };
  const balanceCheckins: Record<string, BalanceCheckin> = {
    // Un saldo que solo estaba en los datos actuales se marca como borrado:
    // el merge por fecha se quedaría con él.
    ...Object.fromEntries(
      Object.entries(current.balanceCheckins ?? {})
        .filter(([date]) => !imported.balanceCheckins?.[date])
        .map(([date, checkin]) => [
          date,
          { ...checkin, deletedAt: stamp, updatedAt: stamp },
        ]),
    ),
    ...restamp(imported.balanceCheckins),
  };
  // Sin ciclo en el archivo se vuelve al mes natural, también con hora: si no,
  // el ciclo de los datos actuales volvería al fusionar.
  const budgetCycle: BudgetCycleSetting | undefined = imported.budgetCycle
    ? { ...imported.budgetCycle, updatedAt: stamp }
    : current.budgetCycle
      ? { anchor: "calendar", updatedAt: stamp }
      : undefined;
  const receipts: Record<string, SalaryReceipt> = {
    // Igual con "¿Has cobrado?": una respuesta que solo estaba en los datos
    // actuales se deshace en lugar de borrarse.
    ...Object.fromEntries(
      Object.entries(current.salaryReceipts ?? {})
        .filter(([monthId]) => !imported.salaryReceipts?.[monthId])
        .map(([monthId, receipt]) => [
          monthId,
          { ...receipt, undone: true, updatedAt: stamp },
        ]),
    ),
    ...restamp(imported.salaryReceipts),
  };
  const extraPays: Record<string, SalaryExtraPaySettings> = {
    // Una paga extra que solo estaba en los datos actuales se reescribe con la
    // que el archivo tiene vigente ese mes (o sin pagas): los meses quedan como
    // en el archivo y una fusión con la versión anterior no la devuelve.
    ...Object.fromEntries(
      Object.keys(current.salaryExtraPays ?? {})
        .filter((monthId) => !imported.salaryExtraPays?.[monthId])
        .map((monthId): [string, SalaryExtraPaySettings] => {
          const inForce = getSalaryExtraPaySettings(imported, monthId);
          return [
            monthId,
            {
              months: [...(inForce?.months ?? [])],
              ...(inForce?.amount !== undefined ? { amount: inForce.amount } : {}),
              updatedAt: stamp,
            },
          ];
        }),
    ),
    ...restamp(imported.salaryExtraPays),
  };

  return {
    ...imported,
    incomeEvents: imported.incomeEvents.map((event) => ({ ...event, updatedAt: stamp })),
    monthlySalary: restamp(imported.monthlySalary),
    monthlySavingsTargets: Object.fromEntries(
      Object.entries(imported.monthlySavingsTargets).map(([monthId, target]) => [
        monthId,
        typeof target === "number"
          ? { amount: target, updatedAt: stamp }
          : { ...target, updatedAt: stamp },
      ]),
    ),
    monthlySavingsContributions: restamp(imported.monthlySavingsContributions),
    ...withNonEmpty("monthClosures", closures),
    ...withNonEmpty("balanceCheckins", balanceCheckins),
    ...(budgetCycle ? { budgetCycle } : {}),
    ...withNonEmpty("salaryExtraPays", extraPays),
    ...withNonEmpty("salaryReceipts", receipts),
  };
}

function ids(items: Array<{ id: string }>) {
  return new Set(items.map((item) => item.id));
}
