import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadExpenseStore, saveExpenseStore } from "@/data/persistence/local-store";
import { emptyFinanceStore } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { ExpenseStoreProvider } from "@/stores/app/use-expense-store";
import { AccountsDashboard } from "./AccountsDashboard";

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => {
    throw new Error("No Supabase in tests");
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/accounts",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

// El registro de saldo de antes de las cuentas y un recibo de 800 € por pagar
// el 28 de octubre.
const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    {
      id: "rent",
      userId: "demo",
      name: "Alquiler",
      description: "",
      amount: 800,
      currency: "EUR",
      categoryId: "cat",
      startDate: "2026-10-28",
      dueDay: 28,
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
  finance: {
    ...emptyFinanceStore,
    balanceCheckins: {
      "2026-10-20": { amount: 1000, updatedAt: "2026-10-20T10:00:00.000Z" },
    },
  },
};

async function renderDashboard() {
  render(
    <ExpenseStoreProvider>
      <AccountsDashboard />
    </ExpenseStoreProvider>,
  );
  return screen.findByRole("region", { name: "Cuentas" });
}

function sheet(name: string) {
  return screen.getByRole("dialog", { name });
}

describe("AccountsDashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  it("renames the migrated account, adds a savings account and compares balances", async () => {
    const section = await renderDashboard();
    const coverage = () => within(section).getByRole("group", { name: "Recibos de octubre" });
    await waitFor(() => expect(coverage()).toHaveTextContent(/te sobran 200,00\s€/));

    // Renombrar la cuenta migrada.
    fireEvent.click(within(section).getByRole("button", { name: "Editar Cuenta de recibos" }));
    fireEvent.change(within(sheet("Editar cuenta")).getByLabelText(/Nombre/), {
      target: { value: "Sabadell" },
    });
    fireEvent.click(within(sheet("Editar cuenta")).getByRole("button", { name: "Guardar cuenta" }));
    expect(within(section).getByRole("article", { name: "Sabadell" })).toBeInTheDocument();

    // Añadir una cuenta de ahorro.
    fireEvent.click(within(section).getByRole("button", { name: "Añadir cuenta" }));
    const editor = sheet("Nueva cuenta");
    fireEvent.change(within(editor).getByLabelText(/Nombre/), { target: { value: "BBVA ahorro" } });
    fireEvent.click(within(editor).getByRole("radio", { name: /Ahorro/ }));
    fireEvent.click(within(editor).getByRole("button", { name: "Añadir cuenta" }));
    const savings = within(section).getByRole("article", { name: "BBVA ahorro" });

    // Anotar su saldo y, desde la misma hoja, cambiar a Sabadell.
    fireEvent.click(within(savings).getByRole("button", { name: /Anotar saldo/ }));
    const form = sheet("Anotar saldo");
    fireEvent.change(within(form).getByLabelText("Saldo"), { target: { value: "5000" } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar saldo" }));
    expect(savings).toHaveTextContent(/5\.?000,00\s€/);

    fireEvent.click(within(savings).getByRole("button", { name: /Anotar saldo/ }));
    fireEvent.click(within(sheet("Anotar saldo")).getByRole("button", { name: "Cuenta: BBVA ahorro" }));
    fireEvent.click(screen.getByRole("option", { name: "Sabadell" }));
    // Sin tocar el importe, pasa a ser el último saldo de Sabadell.
    expect(within(sheet("Anotar saldo")).getByLabelText("Saldo")).toHaveValue("1000");
    fireEvent.change(within(sheet("Anotar saldo")).getByLabelText("Saldo"), { target: { value: "650" } });
    fireEvent.click(within(sheet("Anotar saldo")).getByRole("button", { name: "Guardar saldo" }));

    expect(coverage()).toHaveTextContent(/te faltan 150,00\s€/);
    const saved = loadExpenseStore();
    expect(saved.finance.balanceCheckins?.["2026-10-23"]).toMatchObject({ amount: 650 });
    expect(saved.finance.balanceAccounts?.primary).toMatchObject({ name: "Sabadell", role: "bills" });
    const savingsEntry = Object.entries(saved.finance.balanceAccounts ?? {}).find(
      ([, account]) => account.role === "savings",
    );
    expect(savingsEntry?.[1].name).toBe("BBVA ahorro");
    expect(saved.finance.accountCheckins?.[`${savingsEntry?.[0]}:2026-10-23`]).toMatchObject({
      amount: 5000,
    });
  });

  it("heads the tab with what is left over in the bills account", async () => {
    const section = await renderDashboard();
    await waitFor(() =>
      expect(screen.getByText("Te sobran · Cuenta de recibos")).toBeInTheDocument(),
    );
    expect(document.querySelector("header [class*='app-money']")).toHaveTextContent(
      /200,00\s€/,
    );
    // Sin barra de mes: Cuentas mira siempre el mes activo.
    expect(screen.queryByRole("navigation", { name: "Cambiar de mes" })).toBeNull();
    expect(screen.getByRole("link", { name: "Cuentas" })).toHaveAttribute("aria-current", "page");

    // Con un saldo que no llega, lo que falta.
    fireEvent.click(within(section).getByRole("button", { name: /Anotar saldo/ }));
    fireEvent.change(within(sheet("Anotar saldo")).getByLabelText("Saldo"), {
      target: { value: "500" },
    });
    fireEvent.click(within(sheet("Anotar saldo")).getByRole("button", { name: "Guardar saldo" }));
    expect(screen.getByText("Te faltan · Cuenta de recibos")).toBeInTheDocument();
  });

  it("deletes an account after confirming", async () => {
    const section = await renderDashboard();

    fireEvent.click(within(section).getByRole("button", { name: "Editar Cuenta de recibos" }));
    fireEvent.click(within(sheet("Editar cuenta")).getByRole("button", { name: "Borrar cuenta" }));
    const dialog = screen.getByRole("alertdialog", { name: "¿Borrar «Cuenta de recibos»?" });
    expect(dialog).toHaveTextContent("Se borran la cuenta y su saldo anotado.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Borrar cuenta" }));

    expect(within(section).getByText("Aún no has añadido cuentas.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Editar cuenta" })).not.toBeInTheDocument();
    // Sin cuentas ni saldos, una cabecera neutra.
    expect(screen.getByText("Sin saldo anotado")).toBeInTheDocument();
    expect(loadExpenseStore().finance.balanceAccounts?.primary?.deletedAt).toBeTruthy();
  });
});
