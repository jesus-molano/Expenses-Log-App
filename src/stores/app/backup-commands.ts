import {
  emptyFinanceStore,
  getSalaryExtraPaySettings,
  materializeClosedOccurrenceRecords,
  occurrenceRecordId,
  salaryClearedTombstone,
} from "@/domain/finance";
import {
  ACCOUNT_ID_MAX_LENGTH,
  PRIMARY_ACCOUNT_DEFAULTS,
  PRIMARY_ACCOUNT_ID,
  accountCheckinKey,
  listBalanceAccounts,
  parseAccountCheckinKey,
  storedBalanceAccount,
} from "@/domain/balance-accounts";
import { occurrenceKeyOf, overrideIdFor } from "@/domain/overrides";
import type {
  BalanceAccount,
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
import { DEFAULT_THEME } from "@/shared/theme";

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
//   volver a usarlo. Las cuentas y sus saldos se borran con `deletedAt`.
// - Lo importado cuyo id ya tiene tombstone (se borró aquí o en el archivo)
//   entra con un id nuevo (`rekeyTombstonedIds`); una cuenta borrada aquí,
//   también (`rekeyTombstonedAccounts`).
// - Los objetivos de ahorro no tienen tombstone: un mes que solo estaba en los
//   datos actuales podría volver en esa fusión.
// Tema e idioma son del dispositivo y no se tocan; los avisos son de la cuenta
// y vienen del archivo (`replacePreferences`).
export function replaceStoreContents(
  current: ExpenseStore,
  file: ExpenseStore,
  { scope, now = new Date() }: { scope: ImportScope; now?: Date },
): ExpenseStore {
  const stamp = now.toISOString();
  const suffix = `-r${now.getTime().toString(36)}`;
  const deleted = current.deleted ?? {};
  const importedDeleted = scope === "all" ? (file.deleted ?? {}) : {};
  const rekeyed = rekeyTombstonedIds(
    file,
    (key) => new Set([...(deleted[key] ?? []), ...(importedDeleted[key] ?? [])]),
    { scope, suffix },
  );
  const imported =
    scope === "all"
      ? {
          ...rekeyed,
          finance: rekeyTombstonedAccounts(current.finance, rekeyed.finance, { suffix, stamp }),
        }
      : rekeyed;
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
    preferences: replacePreferences(current, imported, { scope, stamp }),
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

type TombstoneKey = keyof NonNullable<ExpenseStore["deleted"]>;

// Un id con tombstone no puede volver tal cual: quitarle el tombstone solo
// vale en este dispositivo, y la siguiente fusión con una copia que aún lo
// tenga (la nube, otra pestaña, otro dispositivo) lo borraría otra vez. Lo
// importado con esos ids entra con uno nuevo, junto con lo que depende de
// ellos (categoría de los gastos, cobros e histórico de un gasto), y el
// tombstone se queda: esas copias sueltan la versión antigua y nada se
// duplica. No cambia el formato, así que los builds anteriores lo entienden.
function rekeyTombstonedIds(
  imported: ExpenseStore,
  tombstoned: (key: TombstoneKey) => Set<string>,
  { scope, suffix }: { scope: ImportScope; suffix: string },
): ExpenseStore {
  const remap = (items: Array<{ id: string }>, key: TombstoneKey) => {
    const blocked = tombstoned(key);
    return new Map(
      items.filter((item) => blocked.has(item.id)).map((item) => [item.id, `${item.id}${suffix}`]),
    );
  };
  const categoryIds = remap(imported.categories, "categories");
  const templateIds = remap(imported.templates, "templates");
  // El histórico de un gasto que ya no existe también: su id sale del gasto.
  const importedTemplateIds = ids(imported.templates);
  const blockedRecords = tombstoned("occurrenceRecords");
  for (const record of imported.occurrenceRecords ?? []) {
    if (!importedTemplateIds.has(record.templateId) && blockedRecords.has(record.id)) {
      templateIds.set(record.templateId, `${record.templateId}${suffix}`);
    }
  }
  const incomeIds = scope === "all" ? remap(imported.finance.incomeEvents, "incomeEvents") : new Map();
  const contributionIds =
    scope === "all"
      ? remap(Object.values(imported.finance.monthlySavingsContributions ?? {}), "savingsContributions")
      : new Map();
  if (!categoryIds.size && !templateIds.size && !incomeIds.size && !contributionIds.size) {
    return imported;
  }

  const rekeyed = <T extends { id: string }>(item: T, map: Map<string, string>): T => {
    const id = map.get(item.id);
    return id ? { ...item, id } : item;
  };
  const category = <T extends { categoryId?: string }>(item: T): T => {
    const categoryId = item.categoryId && categoryIds.get(item.categoryId);
    return categoryId ? { ...item, categoryId } : item;
  };
  const template = <T extends { templateId: string }>(
    item: T,
    idFor: (templateId: string) => string,
  ): T => {
    const templateId = templateIds.get(item.templateId);
    return templateId ? { ...item, templateId, id: idFor(templateId) } : item;
  };
  const contributions = imported.finance.monthlySavingsContributions;

  return {
    ...imported,
    categories: imported.categories.map((item) => rekeyed(item, categoryIds)),
    templates: imported.templates.map((item) => category(rekeyed(item, templateIds))),
    overrides: imported.overrides.map((item) =>
      category(
        template(item, (templateId) =>
          overrideIdFor({ templateId, occurrenceDate: item.occurrenceDate }),
        ),
      ),
    ),
    occurrenceRecords: imported.occurrenceRecords?.map((item) =>
      category(template(item, (templateId) => occurrenceRecordId(templateId, item.occurrenceDate))),
    ),
    finance: {
      ...imported.finance,
      incomeEvents: imported.finance.incomeEvents.map((item) => rekeyed(item, incomeIds)),
      ...(contributions
        ? {
            monthlySavingsContributions: Object.fromEntries(
              Object.entries(contributions).map(([monthId, item]) => [
                monthId,
                rekeyed(item, contributionIds),
              ]),
            ),
          }
        : {}),
    },
  };
}

// El borrado de una cuenta gana siempre al fusionar (`mergeAccountRecord`):
// una cuenta del archivo cuyo id está borrado aquí entra con un id nuevo, con
// sus saldos, y el borrado se queda. La `primary` pasa entonces a ser una
// cuenta más y sus saldos salen de `balanceCheckins` (que ya están borrados
// aquí) a `accountCheckins`. El nombre vacío sigue siendo el de su papel.
function rekeyTombstonedAccounts(
  current: FinanceStore,
  imported: FinanceStore,
  { suffix, stamp }: { suffix: string; stamp: string },
): FinanceStore {
  const blocked = listBalanceAccounts(imported).filter(
    (account) => current.balanceAccounts?.[account.id]?.deletedAt,
  );
  if (!blocked.length) return imported;

  const accounts = { ...imported.balanceAccounts };
  const checkins = { ...imported.accountCheckins };
  let balanceCheckins = imported.balanceCheckins;
  for (const { id } of blocked) {
    const nextId = restoredAccountId(id, suffix, (candidate) =>
      Boolean(
        Object.prototype.hasOwnProperty.call(accounts, candidate) ||
          current.balanceAccounts?.[candidate],
      ),
    );
    const account = storedBalanceAccount(imported, id)!;
    delete accounts[id];
    accounts[nextId] = { ...account, createdAt: account.createdAt || stamp };
    if (id === PRIMARY_ACCOUNT_ID) {
      for (const [date, checkin] of Object.entries(balanceCheckins ?? {})) {
        checkins[accountCheckinKey(nextId, date)] = checkin;
      }
      balanceCheckins = undefined;
      continue;
    }
    for (const [key, checkin] of Object.entries(imported.accountCheckins ?? {})) {
      const parsed = parseAccountCheckinKey(key);
      if (parsed?.accountId !== id) continue;
      delete checkins[key];
      checkins[accountCheckinKey(nextId, parsed.date)] = checkin;
    }
  }

  const finance: FinanceStore = { ...imported };
  delete finance.balanceCheckins;
  delete finance.balanceAccounts;
  delete finance.accountCheckins;
  return {
    ...finance,
    ...withNonEmpty("balanceCheckins", balanceCheckins ?? {}),
    ...withNonEmpty("balanceAccounts", accounts),
    ...withNonEmpty("accountCheckins", checkins),
  };
}

// Id nuevo de una cuenta restaurada: sin acumular sufijos al restaurar varias
// veces, dentro del largo que admite la normalización (si no, la cuenta se
// descartaría) y sin pisar otra cuenta (dos borradas que comparten raíz, como
// "ahorro" y "ahorro-r…", no acaban en la misma).
function restoredAccountId(id: string, suffix: string, taken: (id: string) => boolean) {
  const root = id.replace(/-r[0-9a-z]+$/, "");
  for (let attempt = 1; ; attempt += 1) {
    const tail = attempt === 1 ? suffix : `${suffix}${attempt}`;
    const candidate = `${root.slice(0, ACCOUNT_ID_MAX_LENGTH - tail.length)}${tail}`;
    if (!taken(candidate)) return candidate;
  }
}

// Tema e idioma se quedan: son de este dispositivo. Los avisos son de la
// cuenta (los lee el cron), así que al sustituirlo todo vienen del archivo,
// con la hora de ahora para ganar a las copias anteriores al fusionar. Un
// archivo sin avisos (de un build anterior) deja los actuales.
function replacePreferences(
  current: ExpenseStore,
  imported: ExpenseStore,
  { scope, stamp }: { scope: ImportScope; stamp: string },
): ExpenseStore["preferences"] {
  const reminders = scope === "all" ? imported.preferences?.reminders : undefined;
  if (!reminders) return current.preferences;
  return {
    ...current.preferences,
    theme: current.preferences?.theme ?? DEFAULT_THEME,
    reminders: { ...reminders, updatedAt: stamp },
  };
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
  const accountCheckins: Record<string, BalanceCheckin> = {
    // Igual con los saldos de las demás cuentas.
    ...Object.fromEntries(
      Object.entries(current.accountCheckins ?? {})
        .filter(([key]) => !imported.accountCheckins?.[key])
        .map(([key, checkin]) => [key, { ...checkin, deletedAt: stamp, updatedAt: stamp }]),
    ),
    ...restamp(imported.accountCheckins),
  };
  // Una cuenta que solo estaba en los datos actuales se borra. Excepción: si
  // el archivo trae saldos de la `primary` sin sus metadatos (es de un build
  // anterior a las cuentas), la `primary` vuelve a sus valores por defecto.
  const importedHasPrimary = listBalanceAccounts(imported).some(
    (account) => account.id === PRIMARY_ACCOUNT_ID,
  );
  const balanceAccounts: Record<string, BalanceAccount> = {
    ...Object.fromEntries(
      Object.entries(current.balanceAccounts ?? {})
        .filter(([id]) => !imported.balanceAccounts?.[id])
        .map(([id, account]): [string, BalanceAccount] => [
          id,
          account.deletedAt
            ? account
            : id === PRIMARY_ACCOUNT_ID && importedHasPrimary
              ? { ...account, ...PRIMARY_ACCOUNT_DEFAULTS, updatedAt: stamp }
              : { ...account, deletedAt: stamp, updatedAt: stamp },
        ]),
    ),
    ...restamp(imported.balanceAccounts),
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
    ...withNonEmpty("balanceAccounts", balanceAccounts),
    ...withNonEmpty("accountCheckins", accountCheckins),
    ...(budgetCycle ? { budgetCycle } : {}),
    ...withNonEmpty("salaryExtraPays", extraPays),
    ...withNonEmpty("salaryReceipts", receipts),
  };
}

function ids(items: Array<{ id: string }>) {
  return new Set(items.map((item) => item.id));
}
