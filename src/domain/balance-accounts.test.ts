import { describe, expect, it } from "vitest";
import {
  PRIMARY_ACCOUNT_ID,
  accountCheckinKey,
  balanceCheckinsOf,
  isBalanceAccountOpen,
  listBalanceAccounts,
  nextBalanceAccountOrder,
  parseAccountCheckinKey,
  storedBalanceAccount,
} from "./balance-accounts";
import { emptyFinanceStore } from "./finance";
import type { BalanceAccount, FinanceStore } from "./types";

const at = "2026-10-01T10:00:00.000Z";

function account(
  role: BalanceAccount["role"],
  order: number,
  extra: Partial<BalanceAccount> = {},
): BalanceAccount {
  return { name: "", role, order, createdAt: at, updatedAt: at, ...extra };
}

describe("account check-in keys", () => {
  it("joins and splits the account id and the date", () => {
    expect(accountCheckinKey("account-1", "2026-10-23")).toBe("account-1:2026-10-23");
    expect(parseAccountCheckinKey("account-1:2026-10-23")).toEqual({
      accountId: "account-1",
      date: "2026-10-23",
    });
  });

  it("rejects keys without a valid id or date", () => {
    for (const key of ["2026-10-23", "a:b", ":2026-10-23", "a b:2026-10-23", "a:2026-02-30", "a:2026-10-23:x"]) {
      expect(parseAccountCheckinKey(key)).toBeNull();
    }
  });
});

describe("listBalanceAccounts", () => {
  it("starts with no accounts", () => {
    expect(listBalanceAccounts(emptyFinanceStore)).toEqual([]);
  });

  it("shows the balance log of older builds as the default bills account", () => {
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      balanceCheckins: { "2026-10-01": { amount: 900, updatedAt: at } },
    };

    expect(listBalanceAccounts(finance)).toEqual([
      { id: PRIMARY_ACCOUNT_ID, name: "", role: "bills", order: 0 },
    ]);
  });

  it("hides the default account when its only balances were deleted", () => {
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      balanceCheckins: { "2026-10-01": { amount: 900, updatedAt: at, deletedAt: at } },
    };

    expect(listBalanceAccounts(finance)).toEqual([]);
  });

  it("uses the stored metadata of the default account once edited, even without balances", () => {
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      balanceAccounts: { primary: account("bills", 0, { name: "Sabadell" }) },
    };

    expect(listBalanceAccounts(finance)).toEqual([
      { id: PRIMARY_ACCOUNT_ID, name: "Sabadell", role: "bills", order: 0 },
    ]);
  });

  it("sorts by order, then creation, and leaves out deleted accounts", () => {
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      balanceCheckins: { "2026-10-01": { amount: 900, updatedAt: at } },
      balanceAccounts: {
        spending: account("spending", 2),
        savings: account("savings", 1, { createdAt: "2026-10-02T00:00:00.000Z" }),
        twin: account("savings", 1),
        gone: account("bills", 0, { deletedAt: at }),
      },
    };

    expect(listBalanceAccounts(finance).map((item) => item.id)).toEqual([
      PRIMARY_ACCOUNT_ID,
      "twin",
      "savings",
      "spending",
    ]);
  });

  it("keeps a deleted default account hidden even if an older build records a balance", () => {
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      balanceCheckins: { "2026-10-20": { amount: 50, updatedAt: "2026-10-20T00:00:00.000Z" } },
      balanceAccounts: { primary: account("bills", 0, { deletedAt: at }) },
    };

    expect(listBalanceAccounts(finance)).toEqual([]);
    expect(isBalanceAccountOpen(finance, PRIMARY_ACCOUNT_ID)).toBe(false);
  });
});

describe("account metadata and balances", () => {
  const finance: FinanceStore = {
    ...emptyFinanceStore,
    balanceCheckins: { "2026-10-01": { amount: 900, updatedAt: at } },
    balanceAccounts: { savings: account("savings", 3), gone: account("bills", 7, { deletedAt: at }) },
    accountCheckins: {
      "savings:2026-10-05": { amount: 5000, updatedAt: at },
      "savings:2026-10-09": { amount: 5300, updatedAt: at, deletedAt: at },
      "other:2026-10-05": { amount: 1, updatedAt: at },
    },
  };

  it("gives the default account its defaults until it is edited", () => {
    expect(storedBalanceAccount(emptyFinanceStore, PRIMARY_ACCOUNT_ID)).toMatchObject({
      name: "",
      role: "bills",
      order: 0,
    });
    expect(storedBalanceAccount(finance, "savings")).toEqual(finance.balanceAccounts!.savings);
    expect(storedBalanceAccount(finance, "unknown")).toBeNull();
  });

  it("knows which accounts accept balances", () => {
    expect(isBalanceAccountOpen(emptyFinanceStore, PRIMARY_ACCOUNT_ID)).toBe(true);
    expect(isBalanceAccountOpen(finance, "savings")).toBe(true);
    expect(isBalanceAccountOpen(finance, "gone")).toBe(false);
    expect(isBalanceAccountOpen(finance, "unknown")).toBe(false);
  });

  it("reads each account's balances from its own key", () => {
    expect(balanceCheckinsOf(finance, PRIMARY_ACCOUNT_ID)).toEqual(finance.balanceCheckins);
    expect(balanceCheckinsOf(finance, "savings")).toEqual({
      "2026-10-05": { amount: 5000, updatedAt: at },
      "2026-10-09": { amount: 5300, updatedAt: at, deletedAt: at },
    });
    expect(balanceCheckinsOf(emptyFinanceStore, "savings")).toEqual({});
  });

  it("puts a new account after every other one, deleted ones included", () => {
    expect(nextBalanceAccountOrder(emptyFinanceStore)).toBe(1);
    expect(nextBalanceAccountOrder(finance)).toBe(8);
  });
});
