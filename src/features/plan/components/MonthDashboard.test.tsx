import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadExpenseStore, saveExpenseStore } from "@/data/persistence/local-store";
import { emptyFinanceStore } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { ExpenseStoreProvider } from "@/stores/app/use-expense-store";
import { MonthDashboard } from "./MonthDashboard";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => {
    throw new Error("No Supabase in tests");
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/money",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

function template(id: string, name: string, amount: number, dueDay: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount,
    currency: "EUR",
    categoryId: "cat",
    startDate: "2026-09-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function paid(templateId: string, occurrenceDate: string) {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid" as const,
    paidAt: `${occurrenceDate}T09:00:00.000Z`,
    updatedAt: `${occurrenceDate}T09:00:00.000Z`,
  };
}

// Octubre con el alquiler pagado y la luz y el gimnasio por pagar; septiembre
// pagado entero y sin ahorro apuntado. La cuenta de recibos tiene 1000 €.
const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    template("rent", "Alquiler", 700, 1),
    template("power", "Luz", 60, 20),
    template("gym", "Gimnasio", 30, 26),
  ],
  overrides: [
    paid("rent", "2026-09-01"),
    paid("power", "2026-09-20"),
    paid("gym", "2026-09-26"),
    paid("rent", "2026-10-01"),
  ],
  finance: {
    ...emptyFinanceStore,
    monthlySalary: {
      "2026-01": { amount: 2000, dayOfMonth: 28, updatedAt: "2026-01-01T00:00:00.000Z" },
    },
    monthlySavingsTargets: {
      "2026-01": { amount: 300, updatedAt: "2026-01-01T00:00:00.000Z" },
    },
    balanceCheckins: {
      "2026-10-20": { amount: 1000, updatedAt: "2026-10-20T10:00:00.000Z" },
    },
  },
};

async function renderMonth() {
  render(
    <ExpenseStoreProvider>
      <MonthDashboard />
    </ExpenseStoreProvider>,
  );
  await screen.findByRole("heading", { level: 1, name: "Plan de octubre 2026" });
}

function receiptsToggle() {
  return screen.getByRole("button", { name: /Recibos de octubre/ });
}

describe("MonthDashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    saveExpenseStore(store);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T10:00:00"));
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("heads the tab with what is free in the month and links the bills coverage", async () => {
    await renderMonth();

    // 2000 − 790 de recibos − 300 de ahorro.
    expect(screen.getByText("Libre · octubre")).toBeInTheDocument();
    expect(document.querySelector("header [class*='app-money']")).toHaveTextContent(
      /910,00\s€/,
    );
    // Luz y gimnasio quedan por pagar: 1000 − 90.
    const coverage = screen.getByRole("link", { name: /Cuenta de recibos/ });
    expect(coverage).toHaveAttribute("href", "/accounts");
    expect(coverage).toHaveTextContent(/Te sobran 910,00\s€/);
    // La base del plan se cambia desde la fila de ingresos.
    fireEvent.click(screen.getByRole("button", { name: "Cambiar base del plan" }));
    expect(screen.getByRole("dialog", { name: "Base del plan" })).toBeInTheDocument();
  });

  it("keeps the month's bills folded and pays from the list, pending first", async () => {
    await renderMonth();

    const toggle = receiptsToggle();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent(/2 pendientes · 90,00\s€/);
    expect(screen.queryByRole("button", { name: "Marcar Luz como pagado" })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const rows = Array.from(document.querySelectorAll(".app-monthly-expense-row")).map(
      (row) => row.textContent ?? "",
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain("Luz");
    expect(rows[1]).toContain("Gimnasio");
    expect(rows[2]).toContain("Alquiler");

    fireEvent.click(screen.getByRole("button", { name: "Marcar Luz como pagado" }));
    await waitFor(() => expect(toggle).toHaveTextContent(/1 pendiente · 30,00\s€/));
    expect(screen.queryByRole("button", { name: "Marcar Luz como pagado" })).toBeNull();
  });

  it("reviews the month from its summary: fixed income, savings and one-off income", async () => {
    await renderMonth();

    fireEvent.click(screen.getByRole("button", { name: /Resumen de octubre/ }));
    const summary = screen.getByRole("dialog", { name: "Resumen de octubre" });
    expect(within(summary).getByRole("heading", { name: /Ingresos puntuales/ })).toBeInTheDocument();
    expect(within(summary).queryByRole("combobox")).toBeNull();

    fireEvent.click(within(summary).getByRole("button", { name: "Editar ingreso fijo" }));
    const salary = screen.getByRole("dialog", { name: "Editar sueldo del mes" });
    expect(salary).toHaveTextContent("octubre 2026");
    fireEvent.click(within(salary).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog", { name: "Editar sueldo del mes" })).toBeNull();

    // El ahorro se edita encima del resumen, que sigue abierto debajo.
    fireEvent.click(within(summary).getByRole("button", { name: "Editar ahorro" }));
    const savings = screen.getByRole("dialog", { name: "Editar ahorro" });
    fireEvent.change(within(savings).getByLabelText("Transferencia real"), {
      target: { value: "250" },
    });
    fireEvent.click(within(savings).getByRole("button", { name: "Guardar ahorro" }));
    expect(screen.queryByRole("dialog", { name: "Editar ahorro" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Resumen de octubre" })).toBeInTheDocument();
    expect(loadExpenseStore().finance.monthlySavingsContributions?.["2026-10"]).toMatchObject({
      amount: 250,
    });
  });

  it("edits and removes the month's one-off income from its summary", async () => {
    saveExpenseStore({
      ...store,
      finance: {
        ...store.finance,
        incomeEvents: [
          {
            id: "bizum",
            userId: "demo",
            name: "Bizum",
            amount: 40,
            currency: "EUR",
            receivedAt: "2026-10-05",
            createdAt: "2026-10-05T10:00:00.000Z",
            updatedAt: "2026-10-05T10:00:00.000Z",
          },
        ],
      },
    });
    await renderMonth();

    fireEvent.click(screen.getByRole("button", { name: /Resumen de octubre/ }));
    const summary = screen.getByRole("dialog", { name: "Resumen de octubre" });
    fireEvent.click(within(summary).getByRole("button", { name: "Editar ingreso" }));
    fireEvent.change(within(summary).getByLabelText("Importe"), { target: { value: "55" } });
    fireEvent.click(within(summary).getByRole("button", { name: "Guardar ingreso" }));
    await waitFor(() =>
      expect(loadExpenseStore().finance.incomeEvents[0]).toMatchObject({ amount: 55 }),
    );

    fireEvent.click(within(summary).getByRole("button", { name: "Quitar ingreso" }));
    const confirm = screen.getByRole("alertdialog", { name: "¿Quitar «Bizum»?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(loadExpenseStore().finance.incomeEvents).toEqual([]));
    expect(within(summary).getByText("Sin ingresos puntuales en este mes.")).toBeInTheDocument();
  });

  it("warns in a registered month's summary that its savings were not recorded", async () => {
    await renderMonth();

    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Plan de septiembre 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Registrado")).toBeInTheDocument();
    // La cobertura de las cuentas es del mes activo: no se enseña en otro.
    expect(screen.queryByRole("link", { name: /Cuenta de recibos/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Resumen de septiembre/ }));
    const summary = screen.getByRole("dialog", { name: "Resumen de septiembre" });
    expect(summary).toHaveTextContent("Objetivo de ahorro no registrado");
    fireEvent.click(within(summary).getByRole("button", { name: "Registrar ahorro" }));
    expect(screen.getByRole("dialog", { name: "Editar ahorro" })).toHaveTextContent(
      "septiembre 2026",
    );
  });
});
