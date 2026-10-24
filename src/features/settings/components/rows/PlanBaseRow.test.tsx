import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadExpenseStore, saveExpenseStore } from "@/data/persistence/local-store";
import { emptyFinanceStore } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import { ExpenseStoreProvider } from "@/stores/app/use-expense-store";
import { PlanBaseRow } from "./PlanBaseRow";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => {
    throw new Error("No Supabase in tests");
  },
}));

describe("PlanBaseRow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    saveExpenseStore({
      ...emptyStore,
      finance: {
        ...emptyFinanceStore,
        monthlySalary: {
          "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      },
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("changes the salary and savings from Settings with the plan baseline sheet", async () => {
    render(
      <ExpenseStoreProvider>
        <PlanBaseRow language="es" />
      </ExpenseStoreProvider>,
    );

    expect(await screen.findByText("Sueldo y ahorro")).toBeInTheDocument();
    expect(screen.getByText(/^Sueldo 2\.?000,00\s€ · día 28 · ahorro 0,00\s€$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cambiar sueldo y ahorro" }));
    const sheet = screen.getByRole("dialog", { name: "Base del plan" });
    fireEvent.change(within(sheet).getByLabelText("Objetivo habitual de ahorro"), {
      target: { value: "300" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "Guardar configuración" }));

    expect(screen.queryByRole("dialog", { name: "Base del plan" })).toBeNull();
    expect(screen.getByText(/· ahorro 300,00\s€$/)).toBeInTheDocument();
    expect(loadExpenseStore().finance.monthlySavingsTargets["2026-10"]).toMatchObject({
      amount: 300,
    });
  });
});
