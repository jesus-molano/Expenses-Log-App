import { isValidDateOnly } from "./calendar";
import type {
  BalanceAccount,
  BalanceAccountRole,
  BalanceCheckin,
  FinanceStore,
} from "./types";

// Cuenta cuyos saldos viven en `finance.balanceCheckins`: el registro de saldo
// de antes de las cuentas. Los builds anteriores siguen leyéndolo y
// escribiéndolo, así que no se mueve a `accountCheckins`.
export const PRIMARY_ACCOUNT_ID = "primary";

export const BALANCE_ACCOUNT_ROLES = [
  "bills",
  "savings",
  "spending",
] as const satisfies readonly BalanceAccountRole[];

export const ACCOUNT_NAME_MAX_LENGTH = 40;

// La `primary` sin metadatos: la cuenta de los recibos con el nombre por
// defecto de su papel, la primera de la lista.
export const PRIMARY_ACCOUNT_DEFAULTS = {
  name: "",
  role: "bills",
  order: 0,
} as const satisfies Pick<BalanceAccount, "name" | "role" | "order">;

const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const CHECKIN_KEY_PATTERN = /^([A-Za-z0-9_-]{1,80}):(\d{4}-\d{2}-\d{2})$/;

export function isBalanceAccountRole(value: unknown): value is BalanceAccountRole {
  return (BALANCE_ACCOUNT_ROLES as readonly unknown[]).includes(value);
}

export function isBalanceAccountId(value: unknown): value is string {
  return typeof value === "string" && ACCOUNT_ID_PATTERN.test(value);
}

// Clave de un saldo en `accountCheckins`: una entrada plana por cuenta y día.
// Así los builds que no conocen las cuentas la fusionan entrada a entrada por
// `updatedAt` (como cualquier registro desconocido) y no pierden saldos.
export function accountCheckinKey(accountId: string, date: string) {
  return `${accountId}:${date}`;
}

export function parseAccountCheckinKey(
  key: string,
): { accountId: string; date: string } | null {
  const match = CHECKIN_KEY_PATTERN.exec(key);
  if (!match || !isValidDateOnly(match[2])) return null;
  return { accountId: match[1], date: match[2] };
}

// Cuenta tal como se guarda o, para la `primary` sin metadatos, con sus
// valores por defecto. null si no existe.
export function storedBalanceAccount(
  finance: FinanceStore,
  accountId: string,
): BalanceAccount | null {
  const stored = finance.balanceAccounts?.[accountId];
  if (stored) return stored;
  if (accountId !== PRIMARY_ACCOUNT_ID) return null;
  return { ...PRIMARY_ACCOUNT_DEFAULTS, createdAt: "", updatedAt: "" };
}

// Se le pueden anotar saldos: existe y no está borrada. La `primary` existe
// siempre salvo que se haya borrado.
export function isBalanceAccountOpen(finance: FinanceStore, accountId: string) {
  const account = storedBalanceAccount(finance, accountId);
  return Boolean(account && !account.deletedAt);
}

// Saldos anotados de una cuenta por fecha, borrados incluidos.
export function balanceCheckinsOf(
  finance: FinanceStore,
  accountId: string,
): Record<string, BalanceCheckin> {
  if (accountId === PRIMARY_ACCOUNT_ID) return finance.balanceCheckins ?? {};
  return Object.fromEntries(
    Object.entries(finance.accountCheckins ?? {}).flatMap(([key, checkin]) => {
      const parsed = parseAccountCheckinKey(key);
      return parsed?.accountId === accountId ? [[parsed.date, checkin]] : [];
    }),
  );
}

function hasActiveCheckins(checkins: Record<string, BalanceCheckin>) {
  return Object.values(checkins).some((checkin) => !checkin.deletedAt);
}

export type BalanceAccountView = {
  id: string;
  // Tal como se guarda: vacío es el nombre por defecto de su papel.
  name: string;
  role: BalanceAccountRole;
  order: number;
};

// Cuentas que se muestran, en su orden. La `primary` sin metadatos solo
// aparece si tiene saldos (los de antes de las cuentas): así un usuario nuevo
// empieza sin cuentas. Una cuenta borrada no aparece aunque otro dispositivo
// le haya anotado saldos después.
export function listBalanceAccounts(finance: FinanceStore): BalanceAccountView[] {
  const stored = Object.entries(finance.balanceAccounts ?? {});
  const accounts = stored
    .filter(([, account]) => !account.deletedAt)
    .map(([id, account]) => ({ id, account }));
  if (
    !finance.balanceAccounts?.[PRIMARY_ACCOUNT_ID] &&
    hasActiveCheckins(finance.balanceCheckins ?? {})
  ) {
    accounts.push({
      id: PRIMARY_ACCOUNT_ID,
      account: storedBalanceAccount(finance, PRIMARY_ACCOUNT_ID)!,
    });
  }

  return accounts
    .sort(
      (a, b) =>
        a.account.order - b.account.order ||
        a.account.createdAt.localeCompare(b.account.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .map(({ id, account }) => ({
      id,
      name: account.name,
      role: account.role,
      order: account.order,
    }));
}

// Orden para una cuenta nueva: detrás de todas las que hay, la `primary`
// implícita incluida.
export function nextBalanceAccountOrder(finance: FinanceStore) {
  const orders = [
    ...Object.values(finance.balanceAccounts ?? {}).map((account) => account.order),
    PRIMARY_ACCOUNT_DEFAULTS.order,
  ];
  return Math.max(...orders) + 1;
}
