import {
  ACCOUNT_NAME_MAX_LENGTH,
  PRIMARY_ACCOUNT_ID,
  accountCheckinKey,
  implicitPrimaryAccount,
  isBalanceAccountId,
  isBalanceAccountOpen,
  isBalanceAccountRole,
  listBalanceAccounts,
  nextBalanceAccountOrder,
  parseAccountCheckinKey,
  storedBalanceAccount,
} from "@/domain/balance-accounts";
import { isValidDateOnly } from "@/domain/calendar";
import type {
  BalanceAccount,
  BalanceAccountRole,
  BalanceCheckin,
  ExpenseStore,
} from "@/domain/types";
import {
  deleteBalanceCheckinInStore,
  recordBalanceInStore,
  timestampAfter,
} from "./finance-commands";

export type BalanceAccountInput = {
  name: string;
  role: BalanceAccountRole;
};

export type AccountBalanceInput = {
  accountId: string;
  date: string;
  amount: number;
};

// Nombre limpio: sin espacios de más y con un máximo. Vacío vale: la cuenta
// se llama como su papel ("Cuenta de ahorro").
export function cleanAccountName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, ACCOUNT_NAME_MAX_LENGTH);
}

export function createBalanceAccountId() {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `account-${random}`;
}

// Cuenta nueva al final de la lista.
export function addBalanceAccountInStore(
  store: ExpenseStore,
  input: BalanceAccountInput,
  now: Date = new Date(),
  id: string = createBalanceAccountId(),
): ExpenseStore {
  if (
    !isBalanceAccountRole(input.role) ||
    !isBalanceAccountId(id) ||
    id === PRIMARY_ACCOUNT_ID ||
    store.finance.balanceAccounts?.[id]
  ) {
    return store;
  }
  const stamp = now.toISOString();
  return withBalanceAccount(store, id, {
    name: cleanAccountName(input.name),
    role: input.role,
    order: nextBalanceAccountOrder(store.finance),
    createdAt: stamp,
    updatedAt: stamp,
  });
}

// Cambia el nombre o el papel. La `primary` guarda aquí sus metadatos la
// primera vez que se edita.
export function updateBalanceAccountInStore(
  store: ExpenseStore,
  accountId: string,
  changes: Partial<BalanceAccountInput>,
  now: Date = new Date(),
): ExpenseStore {
  const account = storedBalanceAccount(store.finance, accountId);
  if (!account || account.deletedAt) return store;
  const name = changes.name === undefined ? account.name : cleanAccountName(changes.name);
  const role =
    changes.role !== undefined && isBalanceAccountRole(changes.role) ? changes.role : account.role;
  if (name === account.name && role === account.role) return store;
  return withBalanceAccount(store, accountId, edited(account, { name, role }, now));
}

// Sube (-1) o baja (+1) una cuenta un puesto. Las cuentas que cambian de
// puesto se numeran de nuevo: dos cuentas creadas a la vez en dos
// dispositivos pueden compartir orden.
export function moveBalanceAccountInStore(
  store: ExpenseStore,
  accountId: string,
  direction: -1 | 1,
  now: Date = new Date(),
): ExpenseStore {
  const accounts = listBalanceAccounts(store.finance);
  const index = accounts.findIndex((account) => account.id === accountId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= accounts.length) return store;

  const reordered = [...accounts];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered.reduce((next, view, order) => {
    if (view.order === order) return next;
    const account = storedBalanceAccount(next.finance, view.id)!;
    return withBalanceAccount(next, view.id, edited(account, { order }, now));
  }, store);
}

// Borra la cuenta con su historial. La cuenta queda con `deletedAt` (ese
// borrado gana siempre al fusionar) y cada saldo, con el suyo: así tampoco
// vuelven en los builds anteriores, que solo conocen `balanceCheckins`.
export function deleteBalanceAccountInStore(
  store: ExpenseStore,
  accountId: string,
  now: Date = new Date(),
): ExpenseStore {
  const account = storedBalanceAccount(store.finance, accountId);
  if (!account || account.deletedAt) return store;
  const stamp = timestampAfter(account.updatedAt || undefined, now);
  const withAccount = withBalanceAccount(store, accountId, {
    ...account,
    createdAt: account.createdAt || stamp,
    deletedAt: stamp,
    updatedAt: stamp,
  });
  const tombstone = (checkin: BalanceCheckin): BalanceCheckin => {
    if (checkin.deletedAt) return checkin;
    const deletedAt = timestampAfter(checkin.updatedAt, now);
    return { ...checkin, deletedAt, updatedAt: deletedAt };
  };

  if (accountId === PRIMARY_ACCOUNT_ID) {
    const checkins = withAccount.finance.balanceCheckins;
    if (!checkins) return withAccount;
    return {
      ...withAccount,
      finance: {
        ...withAccount.finance,
        balanceCheckins: mapValues(checkins, tombstone),
      },
    };
  }
  const checkins = withAccount.finance.accountCheckins;
  if (!checkins) return withAccount;
  return {
    ...withAccount,
    finance: {
      ...withAccount.finance,
      accountCheckins: Object.fromEntries(
        Object.entries(checkins).map(([key, checkin]) => [
          key,
          parseAccountCheckinKey(key)?.accountId === accountId ? tombstone(checkin) : checkin,
        ]),
      ),
    },
  };
}

// Anota el saldo de una cuenta un día: uno por cuenta y día, y anotar un día
// borrado lo recupera. Una cuenta borrada no admite saldos.
export function recordAccountBalanceInStore(
  store: ExpenseStore,
  input: AccountBalanceInput,
  now: Date = new Date(),
): ExpenseStore {
  if (!isBalanceAccountOpen(store.finance, input.accountId)) return store;
  if (input.accountId === PRIMARY_ACCOUNT_ID) {
    return recordBalanceInStore(store, input, now);
  }
  const amount = Math.round(input.amount * 100) / 100;
  if (!isValidDateOnly(input.date) || !Number.isFinite(amount)) return store;
  const key = accountCheckinKey(input.accountId, input.date);
  const existing = store.finance.accountCheckins?.[key];
  return withAccountCheckin(store, key, {
    amount,
    updatedAt: timestampAfter(existing?.updatedAt, now),
  });
}

// Borrar guarda `deletedAt`: si no, el merge con otro dispositivo lo
// devolvería. Borrar saldos nunca borra la cuenta: la `primary` sin metadatos
// solo se lista mientras tiene saldos, así que guarda aquí sus valores por
// defecto para no desaparecer con el último.
export function deleteAccountBalanceInStore(
  store: ExpenseStore,
  input: { accountId: string; date: string },
  now: Date = new Date(),
): ExpenseStore {
  if (input.accountId === PRIMARY_ACCOUNT_ID) {
    const next = deleteBalanceCheckinInStore(store, input.date, now);
    if (next === store || store.finance.balanceAccounts?.[PRIMARY_ACCOUNT_ID]) return next;
    return withBalanceAccount(next, PRIMARY_ACCOUNT_ID, implicitPrimaryAccount());
  }
  const key = accountCheckinKey(input.accountId, input.date);
  const existing = store.finance.accountCheckins?.[key];
  if (!existing || existing.deletedAt) return store;
  const timestamp = timestampAfter(existing.updatedAt, now);
  return withAccountCheckin(store, key, {
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
  });
}

// Versión editada de una cuenta, siempre posterior a la anterior aunque el
// reloj vaya atrasado. La `primary` sin metadatos recibe aquí su fecha de
// creación.
function edited(
  account: BalanceAccount,
  changes: Partial<Pick<BalanceAccount, "name" | "role" | "order">>,
  now: Date,
): BalanceAccount {
  const updatedAt = timestampAfter(account.updatedAt || undefined, now);
  return {
    ...account,
    ...changes,
    createdAt: account.createdAt || updatedAt,
    updatedAt,
  };
}

function withBalanceAccount(
  store: ExpenseStore,
  accountId: string,
  account: BalanceAccount,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      balanceAccounts: { ...store.finance.balanceAccounts, [accountId]: account },
    },
  };
}

function withAccountCheckin(
  store: ExpenseStore,
  key: string,
  checkin: BalanceCheckin,
): ExpenseStore {
  return {
    ...store,
    finance: {
      ...store.finance,
      accountCheckins: { ...store.finance.accountCheckins, [key]: checkin },
    },
  };
}

function mapValues<T>(record: Record<string, T>, map: (value: T) => T): Record<string, T> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, map(value)]));
}
