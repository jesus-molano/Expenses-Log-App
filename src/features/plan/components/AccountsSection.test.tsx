import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyFinanceStore } from "@/domain/finance";
import type { FinanceStore } from "@/domain/types";
import { billsCoverage, summarizeAccounts } from "../lib/account-summary";
import { AccountsSection } from "./AccountsSection";

const at = "2026-10-01T10:00:00.000Z";

const finance: FinanceStore = {
  ...emptyFinanceStore,
  balanceCheckins: { "2026-10-20": { amount: 1200, updatedAt: at } },
  balanceAccounts: {
    primary: { name: "Sabadell", role: "bills", order: 0, createdAt: at, updatedAt: at },
    savings: { name: "BBVA ahorro", role: "savings", order: 1, createdAt: at, updatedAt: at },
  },
  accountCheckins: {
    "savings:2026-10-01": { amount: 5000, updatedAt: at },
    "savings:2026-10-15": { amount: 5300, updatedAt: at },
  },
};

function renderSection(
  data: FinanceStore,
  { pending = 800, monthStart = "2026-10-01" }: { pending?: number; monthStart?: string } = {},
) {
  const handlers = {
    onAdd: vi.fn(),
    onRecord: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
    onDeleteEntry: vi.fn(),
  };
  const summaries = summarizeAccounts(data);
  render(
    <AccountsSection
      language="es"
      monthId="2026-10"
      summaries={summaries}
      coverage={billsCoverage(summaries, { pending, monthStart })}
      savingsTarget={300}
      {...handlers}
    />,
  );
  return handlers;
}

describe("AccountsSection", () => {
  it("invites to add the first account", () => {
    const { onAdd } = renderSection(emptyFinanceStore);

    expect(screen.getByText("Aún no has añadido cuentas.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Añadir cuenta" }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("shows the migrated balance log as the bills account", () => {
    renderSection({
      ...emptyFinanceStore,
      balanceCheckins: { "2026-10-20": { amount: 1200, updatedAt: at } },
    });

    expect(screen.getByRole("article", { name: "Cuenta de recibos" })).toBeInTheDocument();
    expect(screen.queryByText("Aún no has añadido cuentas.")).not.toBeInTheDocument();
  });

  it("compares the bills balance with what is left to pay", () => {
    renderSection(finance);

    const coverage = screen.getByRole("group", { name: "Recibos de octubre" });
    expect(coverage).toHaveTextContent(
      /Saldo 1\.?200,00\s€ · quedan 800,00\s€ por pagar · te sobran 400,00\s€/,
    );
  });

  it("warns when the balance does not cover it and when it may be out of date", () => {
    renderSection(finance, { pending: 1350, monthStart: "2026-10-28" });

    const coverage = screen.getByRole("group", { name: "Recibos de octubre" });
    expect(within(coverage).getByText(/te faltan 150,00\s€/)).toHaveClass("text-[var(--app-warning)]");
    expect(coverage).toHaveTextContent("Es el saldo del 20 oct: puede que ya no esté al día.");
  });

  it("shows the savings goal and the change on a savings account", () => {
    renderSection(finance);

    const savings = screen.getByRole("article", { name: "BBVA ahorro" });
    expect(savings).toHaveTextContent(/Objetivo de ahorro de octubre: 300,00\s€/);
    expect(savings).toHaveTextContent(/\+300,00\s€ desde el 1 oct/);
  });

  it("records, edits, reorders and opens the history of each account", () => {
    const handlers = renderSection(finance);
    const sabadell = within(screen.getByRole("article", { name: "Sabadell" }));
    const savings = within(screen.getByRole("article", { name: "BBVA ahorro" }));

    fireEvent.click(savings.getByRole("button", { name: "Anotar saldo de BBVA ahorro" }));
    expect(handlers.onRecord).toHaveBeenCalledWith("savings");
    fireEvent.click(sabadell.getByRole("button", { name: "Editar Sabadell" }));
    expect(handlers.onEdit).toHaveBeenCalledWith("primary");
    expect(sabadell.getByRole("button", { name: "Subir Sabadell" })).toBeDisabled();
    fireEvent.click(sabadell.getByRole("button", { name: "Bajar Sabadell" }));
    expect(handlers.onMove).toHaveBeenCalledWith("primary", 1);

    const toggle = savings.getByRole("button", { name: "Ver historial" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(savings.getByRole("button", { name: "Borrar el saldo del 15 oct" }));
    expect(handlers.onDeleteEntry).toHaveBeenCalledWith("savings", { date: "2026-10-15", amount: 5300 });
  });
});
