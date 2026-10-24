import { describe, expect, it } from "vitest";
import { listBalanceAccounts } from "@/domain/balance-accounts";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import {
  addBalanceAccountInStore,
  cleanAccountName,
  createBalanceAccountId,
  deleteAccountBalanceInStore,
  deleteBalanceAccountInStore,
  moveBalanceAccountInStore,
  recordAccountBalanceInStore,
  updateBalanceAccountInStore,
} from "./account-commands";

const at = (iso: string) => new Date(iso);
const t1 = "2026-10-20T10:00:00.000Z";
const t2 = "2026-10-21T10:00:00.000Z";

// El registro de saldo de antes de las cuentas: la cuenta `primary`.
const migrated: ExpenseStore = {
  ...emptyStore,
  finance: {
    ...emptyStore.finance,
    balanceCheckins: {
      "2026-10-01": { amount: 1500, updatedAt: "2026-10-01T09:00:00.000Z" },
      "2026-10-15": { amount: 900, updatedAt: "2026-10-15T09:00:00.000Z" },
    },
  },
};

describe("addBalanceAccountInStore", () => {
  it("adds an account after the others with a clean name", () => {
    const store = addBalanceAccountInStore(
      migrated,
      { name: "  BBVA   ahorro ", role: "savings" },
      at(t1),
      "account-savings",
    );

    expect(store.finance.balanceAccounts).toEqual({
      "account-savings": {
        name: "BBVA ahorro",
        role: "savings",
        order: 1,
        createdAt: t1,
        updatedAt: t1,
      },
    });
    expect(listBalanceAccounts(store.finance).map((account) => account.id)).toEqual([
      "primary",
      "account-savings",
    ]);
  });

  it("refuses unknown roles, bad or taken ids and the default account's id", () => {
    const input = { name: "x", role: "savings" } as const;
    const added = addBalanceAccountInStore(emptyStore, input, at(t1), "a");

    expect(addBalanceAccountInStore(emptyStore, { name: "x", role: "other" as never }, at(t1))).toBe(emptyStore);
    expect(addBalanceAccountInStore(emptyStore, input, at(t1), "bad id")).toBe(emptyStore);
    expect(addBalanceAccountInStore(emptyStore, input, at(t1), "primary")).toBe(emptyStore);
    expect(addBalanceAccountInStore(added, input, at(t2), "a")).toBe(added);
  });

  it("creates ids that the store accepts", () => {
    expect(createBalanceAccountId()).toMatch(/^account-[A-Za-z0-9-]+$/);
    expect(createBalanceAccountId()).not.toBe(createBalanceAccountId());
    expect(cleanAccountName("x".repeat(60))).toHaveLength(40);
  });
});

describe("updateBalanceAccountInStore", () => {
  it("stores the default account's metadata the first time it is renamed", () => {
    const store = updateBalanceAccountInStore(migrated, "primary", { name: "Sabadell" }, at(t1));

    expect(store.finance.balanceAccounts?.primary).toEqual({
      name: "Sabadell",
      role: "bills",
      order: 0,
      createdAt: t1,
      updatedAt: t1,
    });
    // Los saldos siguen donde los leen los builds anteriores.
    expect(store.finance.balanceCheckins).toBe(migrated.finance.balanceCheckins);
  });

  it("changes the role, keeps the rest and stays newer on a slow clock", () => {
    const named = updateBalanceAccountInStore(migrated, "primary", { name: "Sabadell" }, at(t2));
    const changed = updateBalanceAccountInStore(named, "primary", { role: "spending" }, at(t1));

    expect(changed.finance.balanceAccounts?.primary).toMatchObject({
      name: "Sabadell",
      role: "spending",
      createdAt: t2,
      updatedAt: "2026-10-21T10:00:00.001Z",
    });
  });

  it("does nothing without changes, for unknown accounts or deleted ones", () => {
    const named = updateBalanceAccountInStore(migrated, "primary", { name: "Sabadell" }, at(t1));
    const deleted = deleteBalanceAccountInStore(named, "primary", at(t2));

    expect(updateBalanceAccountInStore(named, "primary", { name: " Sabadell " })).toBe(named);
    expect(updateBalanceAccountInStore(named, "nope", { name: "x" })).toBe(named);
    expect(updateBalanceAccountInStore(deleted, "primary", { name: "x" })).toBe(deleted);
    expect(updateBalanceAccountInStore(named, "primary", { role: "other" as never })).toBe(named);
  });
});

describe("moveBalanceAccountInStore", () => {
  const withThree = [
    { id: "savings", role: "savings" as const },
    { id: "spending", role: "spending" as const },
  ].reduce(
    (store, { id, role }) => addBalanceAccountInStore(store, { name: id, role }, at(t1), id),
    migrated,
  );
  const order = (store: ExpenseStore) =>
    listBalanceAccounts(store.finance).map((account) => account.id);

  it("swaps an account with its neighbour, writing the default account if it moves", () => {
    const moved = moveBalanceAccountInStore(withThree, "savings", -1, at(t2));

    expect(order(moved)).toEqual(["savings", "primary", "spending"]);
    expect(moved.finance.balanceAccounts?.primary).toMatchObject({ order: 1, updatedAt: t2 });
    expect(moved.finance.balanceAccounts?.savings).toMatchObject({ order: 0, updatedAt: t2 });
    // La que no cambia de puesto no se reescribe.
    expect(moved.finance.balanceAccounts?.spending).toBe(withThree.finance.balanceAccounts?.spending);
    expect(order(moveBalanceAccountInStore(moved, "savings", 1, at(t2)))).toEqual([
      "primary",
      "savings",
      "spending",
    ]);
  });

  it("does nothing past the ends or for unknown accounts", () => {
    expect(moveBalanceAccountInStore(withThree, "primary", -1)).toBe(withThree);
    expect(moveBalanceAccountInStore(withThree, "spending", 1)).toBe(withThree);
    expect(moveBalanceAccountInStore(withThree, "nope", 1)).toBe(withThree);
  });

  it("separates two accounts that ended up with the same order", () => {
    const tied: ExpenseStore = {
      ...withThree,
      finance: {
        ...withThree.finance,
        balanceAccounts: {
          ...withThree.finance.balanceAccounts,
          spending: { ...withThree.finance.balanceAccounts!.spending, order: 1 },
        },
      },
    };
    const moved = moveBalanceAccountInStore(tied, "spending", -1, at(t2));

    expect(order(moved)).toEqual(["primary", "spending", "savings"]);
    expect(moved.finance.balanceAccounts?.savings?.order).toBe(2);
  });
});

describe("deleteBalanceAccountInStore", () => {
  it("deletes an account and every balance it had, with tombstones", () => {
    const store = recordAccountBalanceInStore(
      recordAccountBalanceInStore(
        addBalanceAccountInStore(migrated, { name: "BBVA", role: "spending" }, at(t1), "bbva"),
        { accountId: "bbva", date: "2026-10-20", amount: 400 },
        at(t1),
      ),
      { accountId: "bbva", date: "2026-10-21", amount: 350 },
      at(t2),
    );
    const deleted = deleteBalanceAccountInStore(store, "bbva", at(t1));

    expect(deleted.finance.balanceAccounts?.bbva).toMatchObject({
      deletedAt: "2026-10-20T10:00:00.001Z",
      updatedAt: "2026-10-20T10:00:00.001Z",
    });
    expect(deleted.finance.accountCheckins).toEqual({
      "bbva:2026-10-20": {
        amount: 400,
        updatedAt: "2026-10-20T10:00:00.001Z",
        deletedAt: "2026-10-20T10:00:00.001Z",
      },
      "bbva:2026-10-21": {
        amount: 350,
        updatedAt: "2026-10-21T10:00:00.001Z",
        deletedAt: "2026-10-21T10:00:00.001Z",
      },
    });
    expect(listBalanceAccounts(deleted.finance).map((account) => account.id)).toEqual(["primary"]);
    expect(deleteBalanceAccountInStore(deleted, "bbva")).toBe(deleted);
    expect(deleteBalanceAccountInStore(deleted, "nope")).toBe(deleted);
  });

  it("deletes the default account's balances where older builds read them", () => {
    const deleted = deleteBalanceAccountInStore(migrated, "primary", at(t1));

    expect(deleted.finance.balanceAccounts?.primary).toMatchObject({
      role: "bills",
      createdAt: t1,
      deletedAt: t1,
    });
    expect(
      Object.values(deleted.finance.balanceCheckins ?? {}).every(
        (checkin) => checkin.deletedAt === t1,
      ),
    ).toBe(true);
    expect(listBalanceAccounts(deleted.finance)).toEqual([]);
    // Ni se le pueden anotar saldos.
    expect(
      recordAccountBalanceInStore(deleted, { accountId: "primary", date: "2026-10-21", amount: 1 }),
    ).toBe(deleted);
  });
});

describe("account balances", () => {
  const withSavings = addBalanceAccountInStore(
    migrated,
    { name: "Ahorro", role: "savings" },
    at(t1),
    "savings",
  );

  it("records one balance per account and day, rounded to cents", () => {
    const first = recordAccountBalanceInStore(
      withSavings,
      { accountId: "savings", date: "2026-10-20", amount: 5000.004 },
      at(t1),
    );
    const replaced = recordAccountBalanceInStore(
      first,
      { accountId: "savings", date: "2026-10-20", amount: 5100 },
      at(t2),
    );

    expect(first.finance.accountCheckins).toEqual({
      "savings:2026-10-20": { amount: 5000, updatedAt: t1 },
    });
    expect(replaced.finance.accountCheckins).toEqual({
      "savings:2026-10-20": { amount: 5100, updatedAt: t2 },
    });
    expect(replaced.finance.balanceCheckins).toBe(migrated.finance.balanceCheckins);
  });

  it("records the default account's balances in balanceCheckins", () => {
    const store = recordAccountBalanceInStore(
      withSavings,
      { accountId: "primary", date: "2026-10-20", amount: 1200 },
      at(t1),
    );

    expect(store.finance.balanceCheckins?.["2026-10-20"]).toEqual({ amount: 1200, updatedAt: t1 });
    expect(store.finance.accountCheckins).toBeUndefined();
  });

  it("ignores unknown accounts, impossible dates and amounts", () => {
    expect(
      recordAccountBalanceInStore(withSavings, { accountId: "nope", date: "2026-10-20", amount: 1 }),
    ).toBe(withSavings);
    expect(
      recordAccountBalanceInStore(withSavings, { accountId: "savings", date: "2026-02-30", amount: 1 }),
    ).toBe(withSavings);
    expect(
      recordAccountBalanceInStore(withSavings, {
        accountId: "savings",
        date: "2026-10-20",
        amount: Number.POSITIVE_INFINITY,
      }),
    ).toBe(withSavings);
  });

  it("deletes a balance by marking it, and recording the day again brings it back", () => {
    const recorded = recordAccountBalanceInStore(
      withSavings,
      { accountId: "savings", date: "2026-10-20", amount: 5000 },
      at(t2),
    );
    const deleted = deleteAccountBalanceInStore(
      recorded,
      { accountId: "savings", date: "2026-10-20" },
      at(t1),
    );
    const restored = recordAccountBalanceInStore(
      deleted,
      { accountId: "savings", date: "2026-10-20", amount: 5000 },
      at(t1),
    );

    expect(deleted.finance.accountCheckins?.["savings:2026-10-20"]).toEqual({
      amount: 5000,
      updatedAt: "2026-10-21T10:00:00.001Z",
      deletedAt: "2026-10-21T10:00:00.001Z",
    });
    expect(restored.finance.accountCheckins?.["savings:2026-10-20"]).toEqual({
      amount: 5000,
      updatedAt: "2026-10-21T10:00:00.002Z",
    });
    expect(deleteAccountBalanceInStore(deleted, { accountId: "savings", date: "2026-10-20" })).toBe(
      deleted,
    );
    expect(deleteAccountBalanceInStore(withSavings, { accountId: "savings", date: "2026-10-01" })).toBe(
      withSavings,
    );
  });

  it("deletes the default account's balances from balanceCheckins", () => {
    const deleted = deleteAccountBalanceInStore(
      migrated,
      { accountId: "primary", date: "2026-10-15" },
      at(t1),
    );
    expect(deleted.finance.balanceCheckins?.["2026-10-15"]?.deletedAt).toBe(t1);
  });
});
