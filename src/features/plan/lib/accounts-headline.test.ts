import { describe, expect, it } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import type { BalanceAccount, FinanceStore } from "@/domain/types";
import { billsCoverage, summarizeAccounts } from "./account-summary";
import { accountsHeadline, billsAccountLabel } from "./accounts-headline";

const at = "2026-10-01T10:00:00.000Z";

function account(role: BalanceAccount["role"], order: number, name = ""): BalanceAccount {
  return { name, role, order, createdAt: at, updatedAt: at };
}

function headline(finance: FinanceStore, pending: number) {
  const summaries = summarizeAccounts(finance);
  const coverage = billsCoverage(summaries, { pending, monthStart: "2026-10-01" });
  return accountsHeadline(summaries, coverage, "es");
}

describe("accountsHeadline", () => {
  it("says what is left over in the bills account", () => {
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      balanceAccounts: { primary: account("bills", 0, "Sabadell") },
      balanceCheckins: { "2026-10-20": { amount: 1000, updatedAt: at } },
    };

    expect(headline(finance, 800)).toEqual({
      title: "Te sobran · Sabadell",
      label: expect.stringMatching(/^200,00\s€$/),
    });
    expect(headline(finance, 1150)).toEqual({
      title: "Te faltan · Sabadell",
      label: expect.stringMatching(/^150,00\s€$/),
    });
  });

  it("names the role when several bills accounts are added up", () => {
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      balanceCheckins: { "2026-10-20": { amount: 600, updatedAt: at } },
      balanceAccounts: { other: account("bills", 1, "Nómina") },
      accountCheckins: { "other:2026-10-21": { amount: 400, updatedAt: at } },
    };

    expect(headline(finance, 900).title).toBe("Te sobran · Recibos");
    expect(billsAccountLabel(summarizeAccounts(finance), "en")).toBe("Bills");
  });

  it("names the only bills account even before it has a balance", () => {
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      balanceAccounts: { primary: account("bills", 0, "Sabadell") },
    };

    expect(billsAccountLabel(summarizeAccounts(finance), "es")).toBe("Sabadell");
  });

  it("falls back to the total balance when the bills account has none", () => {
    const finance: FinanceStore = {
      ...emptyFinanceStore,
      balanceAccounts: {
        primary: account("bills", 0),
        savings: account("savings", 1, "BBVA ahorro"),
        spending: account("spending", 2, "BBVA"),
      },
      accountCheckins: {
        "savings:2026-10-01": { amount: 5000, updatedAt: at },
        "savings:2026-10-15": { amount: 5300.5, updatedAt: at },
        "spending:2026-10-10": { amount: 400, updatedAt: at },
      },
    };

    expect(headline(finance, 800)).toEqual({
      title: "Saldo total",
      label: expect.stringMatching(/^5\.?700,50\s€$/),
    });
  });

  it("stays neutral without any balance", () => {
    expect(headline(emptyFinanceStore, 0)).toEqual({ title: "Sin saldo anotado", label: "—" });
    expect(
      accountsHeadline(summarizeAccounts(emptyFinanceStore), null, "en").title,
    ).toBe("No balance recorded");
  });
});
