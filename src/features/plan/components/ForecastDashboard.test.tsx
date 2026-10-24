import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveExpenseStore } from "@/data/persistence/local-store";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate, RecurrenceRule } from "@/domain/types";
import { ExpenseStoreProvider } from "@/stores/app/use-expense-store";
import { ForecastDashboard } from "./ForecastDashboard";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => {
    throw new Error("No Supabase in tests");
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/forecast",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

function template(
  id: string,
  name: string,
  amount: number,
  startDate: string,
  dueDay: number,
  recurrence: RecurrenceRule,
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "cat",
    startDate,
    dueDay,
    recurrence,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// IBI (50 €/mes hasta enero) y seguro (60 €/mes hasta marzo).
const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    template("rent", "Alquiler", 700, "2026-01-01", 1, { frequency: "monthly" }),
    template("insurance", "Seguro del coche", 300, "2026-03-20", 20, {
      frequency: "yearly",
      annualMonth: 3,
    }),
    template("ibi", "IBI", 150, "2026-01-10", 10, { frequency: "quarterly" }),
  ],
};

describe("ForecastDashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    saveExpenseStore(store);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T10:00:00"));
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

  it("heads the tab with what to set aside each month and lists what comes", async () => {
    render(
      <ExpenseStoreProvider>
        <ForecastDashboard />
      </ExpenseStoreProvider>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Previsión" })).toBeInTheDocument();
    expect(screen.getByText("Aparta al mes")).toBeInTheDocument();
    expect(document.querySelector("header [class*='app-money']")).toHaveTextContent(
      /110,00\s€/,
    );
    expect(screen.getByRole("region", { name: "Próximos recibos grandes" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Coste por categoría" })).toBeInTheDocument();
    const annual = screen.getByRole("region", { name: "Plan anual" });
    expect(within(annual).getByRole("combobox", { name: "Año" })).toHaveValue("2026");
    // Sin barra de mes.
    expect(screen.queryByRole("navigation", { name: "Cambiar de mes" })).toBeNull();
  });
});
