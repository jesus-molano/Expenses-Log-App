import { isValidDateOnly } from "@/domain/calendar";
import {
  createIncomeEvent,
  getMonthlySalarySettings,
  getMonthlySavingsTarget,
  getSalaryExtraPaySettings,
  salaryClearedTombstone,
  toMonthId,
  updateIncomeEvent,
} from "@/domain/finance";
import type {
  BudgetCycleAnchor,
  ExpenseStore,
  FinanceStore,
  MonthClosure,
  MonthlySalarySettings,
} from "@/domain/types";
import type {
  IncomeEventInput,
  MoneySettingsInput,
  MonthlySalaryInput,
  MonthlySavingsContributionInput,
  MonthlySavingsTargetInput,
  SalaryExtraPayInput,
  SalaryReceiptInput,
} from "./store-types";

export function updateMoneySettingsInStore(
  store: ExpenseStore,
  input: MoneySettingsInput,
): ExpenseStore {
  const monthId = toMonthId(input.savingsMonthId);
  const updatedAt = new Date().toISOString();

  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySalary: {
        ...store.finance.monthlySalary,
        [monthId]: {
          amount: Math.max(Number(input.salaryAmount), 0),
          dayOfMonth: Math.min(Math.max(Number(input.salaryDay), 1), 31),
          updatedAt,
        },
      },
      monthlySavingsTargets: {
        ...store.finance.monthlySavingsTargets,
        [monthId]: {
          amount: Math.max(Number(input.savingsTarget), 0),
          updatedAt,
        },
      },
    },
  };
}

export function updateMonthlySavingsTargetInStore(
  store: ExpenseStore,
  input: MonthlySavingsTargetInput,
): ExpenseStore {
  const monthId = toMonthId(input.monthId);
  const updatedAt = new Date().toISOString();
  const nextMonth = nextMonthId(monthId);
  const nextTargets = { ...store.finance.monthlySavingsTargets };
  if (
    monthId < toMonthId(new Date()) &&
    !(nextMonth in nextTargets)
  ) {
    nextTargets[nextMonth] = {
      amount: getMonthlySavingsTarget(store.finance, nextMonth),
      updatedAt,
    };
  }

  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySavingsTargets: {
        ...nextTargets,
        [monthId]: {
          amount: Math.max(Number(input.savingsTarget), 0),
          updatedAt,
        },
      },
    },
  };
}

export function updateMonthlySavingsContributionInStore(
  store: ExpenseStore,
  input: MonthlySavingsContributionInput,
): ExpenseStore {
  const monthId = toMonthId(input.monthId);
  const existing = store.finance.monthlySavingsContributions?.[monthId];
  const amount = Math.max(Number(input.amount), 0);
  const updatedAt = new Date().toISOString();
  const id = existing?.id ?? createSavingsContributionId(monthId, updatedAt);
  const nextContributions = {
    ...(store.finance.monthlySavingsContributions ?? {}),
  };

  if (amount <= 0) {
    delete nextContributions[monthId];
  } else {
    nextContributions[monthId] = {
      id,
      userId: existing?.userId ?? "demo",
      monthId,
      amount,
      transferredAt:
        input.transferredAt ?? existing?.transferredAt ?? updatedAt.slice(0, 10),
      source: "manual",
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt,
    };
  }

  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySavingsContributions: nextContributions,
    },
    deleted: {
      ...store.deleted,
      savingsContributions:
        amount <= 0
          ? Array.from(
              new Set([
                ...(store.deleted?.savingsContributions ?? []),
                id,
              ]),
            )
          : (store.deleted?.savingsContributions ?? []).filter(
              (deletedId) => deletedId !== id,
            ),
    },
  };
}

function createSavingsContributionId(monthId: string, updatedAt: string) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `saving:${monthId}:${randomId ?? updatedAt}`;
}

export function updateMonthlySalaryInStore(
  store: ExpenseStore,
  input: MonthlySalaryInput,
): ExpenseStore {
  const monthId = toMonthId(input.monthId);
  const updatedAt = new Date().toISOString();
  const nextMonth = nextMonthId(monthId);
  const nextSalary = { ...store.finance.monthlySalary };
  const salary: MonthlySalarySettings = {
    amount: Math.max(Number(input.salaryAmount), 0),
    dayOfMonth: Math.min(Math.max(Number(input.salaryDay), 1), 31),
    updatedAt,
  };

  if (input.scope === "month") {
    // Solo este mes (la paga extra, un mes con horas extra...): los
    // siguientes siguen con lo que tenían. Si este mes empezaba un sueldo
    // nuevo, ese sueldo pasa a empezar el primer mes que lo hereda (los de
    // "solo este mes" que vienen detrás no lo heredan).
    let following = nextMonth;
    while (store.finance.monthlySalary[following]?.onlyThisMonth) {
      following = nextMonthId(following);
    }
    const followingBefore = getMonthlySalarySettings(store.finance, following);
    nextSalary[monthId] = { ...salary, onlyThisMonth: true };
    const followingAfter = getMonthlySalarySettings(
      { ...store.finance, monthlySalary: nextSalary },
      following,
    );
    if (
      !(following in store.finance.monthlySalary) &&
      (followingAfter.amount !== followingBefore.amount ||
        followingAfter.dayOfMonth !== followingBefore.dayOfMonth)
    ) {
      nextSalary[following] = {
        amount: followingBefore.amount,
        dayOfMonth: followingBefore.dayOfMonth,
        updatedAt,
      };
    }
    return withMonthlySalary(store, nextSalary);
  }

  if (input.scope === "fromMonth") {
    // Desde este mes: los meses con su propio sueldo lo conservan.
    return withMonthlySalary(store, { ...nextSalary, [monthId]: salary });
  }

  if (
    monthId < toMonthId(new Date()) &&
    !(nextMonth in nextSalary)
  ) {
    nextSalary[nextMonth] = {
      ...getMonthlySalarySettings(store.finance, nextMonth),
      updatedAt,
    };
  }

  return {
    ...store,
    finance: {
      ...store.finance,
      monthlySalary: {
        ...nextSalary,
        [monthId]: {
          amount: Math.max(Number(input.salaryAmount), 0),
          dayOfMonth: Math.min(Math.max(Number(input.salaryDay), 1), 31),
          updatedAt,
        },
      },
    },
  };
}

function withMonthlySalary(
  store: ExpenseStore,
  monthlySalary: FinanceStore["monthlySalary"],
): ExpenseStore {
  return { ...store, finance: { ...store.finance, monthlySalary } };
}

// Pagas extra vigentes desde un mes. Sin cambios no se escribe nada.
export function updateSalaryExtraPayInStore(
  store: ExpenseStore,
  input: SalaryExtraPayInput,
): ExpenseStore {
  const monthId = toMonthId(input.monthId);
  const months = Array.from(
    new Set(input.months.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)),
  ).sort((a, b) => a - b);
  const amount =
    input.amount !== undefined && Number.isFinite(input.amount) && input.amount > 0
      ? input.amount
      : undefined;
  const current = getSalaryExtraPaySettings(store.finance, monthId);
  if (
    (current?.months ?? []).join(",") === months.join(",") &&
    current?.amount === amount
  ) {
    return store;
  }

  return {
    ...store,
    finance: {
      ...store.finance,
      salaryExtraPays: {
        ...store.finance.salaryExtraPays,
        [monthId]: {
          months,
          ...(amount !== undefined ? { amount } : {}),
          updatedAt: new Date().toISOString(),
        },
      },
    },
  };
}

// "¿Has cobrado?" → sí, con lo cobrado de verdad.
export function recordSalaryReceiptInStore(
  store: ExpenseStore,
  input: SalaryReceiptInput,
  now: Date = new Date(),
): ExpenseStore {
  const monthId = toMonthId(input.monthId);
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0 || !isValidDateOnly(input.receivedOn)) {
    return store;
  }
  const previous = store.finance.salaryReceipts?.[monthId];

  return withSalaryReceipt(store, monthId, {
    amount,
    receivedOn: input.receivedOn,
    updatedAt: timestampAfter(previous?.updatedAt, now),
  });
}

// Deshacer no borra la respuesta: un borrado no sobreviviría al merge.
export function undoSalaryReceiptInStore(
  store: ExpenseStore,
  monthId: string,
  now: Date = new Date(),
): ExpenseStore {
  const id = toMonthId(monthId);
  const previous = store.finance.salaryReceipts?.[id];
  if (!previous || previous.undone) return store;
  return withSalaryReceipt(store, id, {
    ...previous,
    undone: true,
    updatedAt: timestampAfter(previous.updatedAt, now),
  });
}

function withSalaryReceipt(
  store: ExpenseStore,
  monthId: string,
  receipt: NonNullable<FinanceStore["salaryReceipts"]>[string],
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      salaryReceipts: { ...store.finance.salaryReceipts, [monthId]: receipt },
    },
  };
}

function nextMonthId(monthId: string) {
  const [year, month] = monthId.split("-").map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function addIncomeEventToStore(
  store: ExpenseStore,
  input: IncomeEventInput,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      incomeEvents: [createIncomeEvent(input), ...store.finance.incomeEvents],
    },
  };
}

export function updateIncomeEventInStore(
  store: ExpenseStore,
  eventId: string,
  input: IncomeEventInput,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      incomeEvents: store.finance.incomeEvents.map((event) =>
        event.id === eventId ? updateIncomeEvent(event, input) : event,
      ),
    },
  };
}

export function deleteIncomeEventFromStore(
  store: ExpenseStore,
  eventId: string,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      incomeEvents: store.finance.incomeEvents.filter(
        (event) => event.id !== eventId,
      ),
    },
    deleted: {
      ...store.deleted,
      incomeEvents: Array.from(
        new Set([...(store.deleted?.incomeEvents ?? []), eventId]),
      ),
    },
  };
}

export function clearIncomeFromStore(store: ExpenseStore): ExpenseStore {
  const incomeEventIds = store.finance.incomeEvents.map((event) => event.id);
  // Sin tombstone, fusionar con la nube devolvería los sueldos borrados.
  const clearedAt = new Date().toISOString();
  // Pagas extra y cobros se vacían con una versión nueva (no se borran), que
  // gana al fusionar.
  const clearedExtraPays = Object.fromEntries(
    Object.keys(store.finance.salaryExtraPays ?? {}).map((monthId) => [
      monthId,
      { months: [], updatedAt: clearedAt },
    ]),
  );
  const clearedReceipts = Object.fromEntries(
    Object.entries(store.finance.salaryReceipts ?? {}).map(([monthId, receipt]) => [
      monthId,
      { ...receipt, undone: true, updatedAt: timestampAfter(receipt.updatedAt, new Date(clearedAt)) },
    ]),
  );

  return {
    ...store,
    finance: {
      ...store.finance,
      incomeEvents: [],
      monthlySalary: {},
      ...(store.finance.salaryExtraPays ? { salaryExtraPays: clearedExtraPays } : {}),
      ...(store.finance.salaryReceipts ? { salaryReceipts: clearedReceipts } : {}),
    },
    deleted: {
      ...store.deleted,
      incomeEvents: mergeDeletedIds(
        store.deleted?.incomeEvents,
        incomeEventIds,
      ),
      monthlySalary: mergeDeletedIds(store.deleted?.monthlySalary, [
        salaryClearedTombstone(clearedAt),
      ]),
    },
  };
}

function mergeDeletedIds(
  current: string[] | undefined,
  next: string[],
): string[] {
  return Array.from(new Set([...(current ?? []), ...next]));
}

export function closeMonthInStore(
  store: ExpenseStore,
  monthId: string,
  now: Date = new Date(),
): ExpenseStore {
  const timestamp = timestampAfter(
    lastClosureChange(store.finance.monthClosures?.[monthId]),
    now,
  );
  return withMonthClosure(store, monthId, {
    closedAt: timestamp,
    updatedAt: timestamp,
  });
}

// Reabrir no borra el cierre: un borrado no sobreviviría al merge con la nube.
export function reopenMonthInStore(
  store: ExpenseStore,
  monthId: string,
  now: Date = new Date(),
): ExpenseStore {
  const closure = store.finance.monthClosures?.[monthId];
  if (!closure) return store;
  const timestamp = timestampAfter(lastClosureChange(closure), now);
  return withMonthClosure(store, monthId, {
    ...closure,
    reopenedAt: timestamp,
    updatedAt: timestamp,
  });
}

// Último cambio de un cierre (cerrar, reabrir o editar). Cada cierre o
// reapertura queda después de él aunque el reloj de este dispositivo vaya
// atrasado (`timestampAfter`): si no, reabrir no surtiría efecto y el merge se
// quedaría con la versión vieja.
function lastClosureChange(closure: MonthClosure | undefined) {
  if (!closure) return undefined;
  const latest = Math.max(
    Date.parse(closure.updatedAt),
    Date.parse(closure.closedAt),
    Date.parse(closure.reopenedAt ?? closure.closedAt),
  );
  return Number.isNaN(latest) ? undefined : new Date(latest).toISOString();
}

function withMonthClosure(
  store: ExpenseStore,
  monthId: string,
  closure: MonthClosure,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      monthClosures: { ...store.finance.monthClosures, [monthId]: closure },
    },
  };
}

// Mes natural o ciclo desde el día de cobro. Se guarda con hora para que gane
// la elección más reciente al fusionar dispositivos.
export function updateBudgetCycleInStore(
  store: ExpenseStore,
  anchor: BudgetCycleAnchor,
  now: Date = new Date(),
): ExpenseStore {
  const current = store.finance.budgetCycle;
  if ((current?.anchor ?? "calendar") === anchor) return store;
  return {
    ...store,
    finance: {
      ...store.finance,
      budgetCycle: { anchor, updatedAt: timestampAfter(current?.updatedAt, now) },
    },
  };
}

// Anota el saldo de la cuenta un día. Un segundo saldo el mismo día sustituye
// al primero; anotar un día borrado lo recupera.
export function recordBalanceInStore(
  store: ExpenseStore,
  input: { date: string; amount: number },
  now: Date = new Date(),
): ExpenseStore {
  if (!isValidDateOnly(input.date) || !Number.isFinite(input.amount)) return store;
  const existing = store.finance.balanceCheckins?.[input.date];
  return withBalanceCheckin(store, input.date, {
    amount: Math.round(input.amount * 100) / 100,
    updatedAt: timestampAfter(existing?.updatedAt, now),
  });
}

// Borrar guarda `deletedAt` en vez de quitar la entrada: si no, el merge con
// otro dispositivo la devolvería.
export function deleteBalanceCheckinInStore(
  store: ExpenseStore,
  date: string,
  now: Date = new Date(),
): ExpenseStore {
  const existing = store.finance.balanceCheckins?.[date];
  if (!existing || existing.deletedAt) return store;
  const timestamp = timestampAfter(existing.updatedAt, now);
  return withBalanceCheckin(store, date, {
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
  });
}

function withBalanceCheckin(
  store: ExpenseStore,
  date: string,
  checkin: NonNullable<ExpenseStore["finance"]["balanceCheckins"]>[string],
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      balanceCheckins: { ...store.finance.balanceCheckins, [date]: checkin },
    },
  };
}

// La hora de un cambio queda siempre después de la del anterior aunque el
// reloj de este dispositivo vaya atrasado: si no, el merge se quedaría con la
// versión vieja.
export function timestampAfter(previous: string | undefined, now: Date) {
  const previousTime = previous ? Date.parse(previous) : Number.NaN;
  return new Date(
    Number.isNaN(previousTime)
      ? now.getTime()
      : Math.max(now.getTime(), previousTime + 1),
  ).toISOString();
}
