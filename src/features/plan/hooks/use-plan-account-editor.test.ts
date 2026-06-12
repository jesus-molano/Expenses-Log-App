import { describe, expect, it } from "vitest";
import type { PlanAccount } from "@/domain/types";
import {
  removePlanAccount,
  togglePlanAccountPurpose,
} from "./use-plan-account-editor";

const accounts: PlanAccount[] = [
  {
    id: "primary",
    name: "Principal",
    purposes: ["salary", "daily"],
  },
  {
    id: "savings",
    name: "Ahorro",
    purposes: ["savings"],
  },
  {
    id: "expenses",
    name: "Gastos",
    purposes: ["expenses"],
  },
];

describe("usePlanAccountEditor helpers", () => {
  it("moves a purpose to the selected account", () => {
    const next = togglePlanAccountPurpose(accounts, accounts[0], "savings");

    expect(next.find((account) => account.id === "primary")?.purposes).toEqual([
      "salary",
      "daily",
      "savings",
    ]);
    expect(next.find((account) => account.id === "savings")?.purposes).toEqual(
      [],
    );
  });

  it("reassigns removed account purposes to the first remaining account", () => {
    const next = removePlanAccount(accounts, "savings");

    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({
      id: "primary",
      purposes: ["salary", "daily", "savings"],
    });
    expect(next[1]).toMatchObject({
      id: "expenses",
      purposes: ["expenses"],
    });
  });
});
