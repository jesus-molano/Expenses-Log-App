import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveExpenseStore } from "@/data/persistence/local-store";
import { emptyFinanceStore } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { ExpenseStoreProvider } from "@/stores/app/use-expense-store";
import { MonthDashboard } from "./MonthDashboard";

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
      <MonthDashboard />
    </ExpenseStoreProvider>,
  );
  const card = await screen.findByRole("region", {
    name: "¿Has cobrado la nómina de octubre?",
  });
  // En Mes el mes no es un encabezado: un párrafo que recibe el foco.
  const monthTitle = screen
    .getByRole("navigation", { name: "Cambiar de mes" })
    .querySelector<HTMLElement>('[tabindex="-1"]');
  if (!monthTitle) throw new Error("MonthBar has no focusable title");
  return { card, monthTitle };
}

describe("MonthDashboard salary prompt focus", () => {
  beforeEach(() => {
    window.localStorage.clear();
    saveExpenseStore(store);
    // Solo la fecha: el día de cobro. Los frames y temporizadores, reales.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T10:00:00"));
    // Lo que jsdom no trae.
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(["Sí, cobrada", "Aún no"])(
    "hands the focus to the month title after '%s'",
    async (answer) => {
      const { card, monthTitle } = await renderOnPayday();
      const button = within(card).getByRole("button", { name: answer });
      button.focus();
      fireEvent.click(button);

      expect(card).not.toBeInTheDocument();
      await waitFor(() => expect(monthTitle).toHaveFocus());
    },
  );
});
