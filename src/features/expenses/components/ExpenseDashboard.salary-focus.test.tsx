import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveExpenseStore } from "@/data/persistence/local-store";
import { emptyFinanceStore } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { ExpenseStoreProvider } from "@/stores/app/use-expense-store";
import { ExpenseDashboard } from "./ExpenseDashboard";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => {
    throw new Error("No Supabase in tests");
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    {
      id: "gym",
      userId: "demo",
      name: "Gimnasio",
      description: "",
      amount: 30,
      currency: "EUR",
      categoryId: "cat",
      startDate: "2026-10-12",
      dueDay: 12,
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
  finance: {
    ...emptyFinanceStore,
    monthlySalary: {
      "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
    },
  },
};

async function renderOnPayday() {
  render(
    <ExpenseStoreProvider>
      <ExpenseDashboard />
    </ExpenseStoreProvider>,
  );
  const card = await screen.findByRole("region", {
    name: "¿Has cobrado la nómina de octubre?",
  });
  const monthTitle = within(screen.getByRole("navigation", { name: "Cambiar de mes" })).getByRole(
    "heading",
  );
  return { card, monthTitle };
}

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

describe("ExpenseDashboard salary prompt focus", () => {
  beforeEach(() => {
    window.localStorage.clear();
    saveExpenseStore(store);
    // Solo la fecha: el día de cobro. Los frames y temporizadores, reales.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hands the focus to the month title after 'Sí, cobrada'", async () => {
    const { card, monthTitle } = await renderOnPayday();
    const yes = within(card).getByRole("button", { name: "Sí, cobrada" });
    yes.focus();
    fireEvent.click(yes);

    expect(card).not.toBeInTheDocument();
    await waitFor(() => expect(monthTitle).toHaveFocus());
  });

  it("hands the focus to the month title after saving another amount", async () => {
    const { card, monthTitle } = await renderOnPayday();
    fireEvent.click(within(card).getByRole("button", { name: "Otro importe" }));
    fireEvent.change(within(card).getByLabelText("Importe cobrado"), {
      target: { value: "1950" },
    });
    const save = within(card).getByRole("button", { name: "Guardar" });
    save.focus();
    fireEvent.click(save);

    expect(card).not.toBeInTheDocument();
    await waitFor(() => expect(monthTitle).toHaveFocus());
  });

  it("keeps the focus on an amount it cannot save", async () => {
    const { card } = await renderOnPayday();
    fireEvent.click(within(card).getByRole("button", { name: "Otro importe" }));
    const amount = within(card).getByLabelText("Importe cobrado");
    fireEvent.change(amount, { target: { value: "abc" } });
    amount.focus();
    fireEvent.submit(amount);
    await nextFrame();

    expect(card).toBeInTheDocument();
    expect(amount).toHaveFocus();
  });
});
