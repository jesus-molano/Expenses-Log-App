import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { monthCloseStatus } from "@/domain/budget-month";
import { emptyFinanceStore, occurrencesDueBetween } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  markOccurrencesPaidInStore,
  moveOccurrenceInStore,
  restoreOccurrenceInStore,
  skipOccurrenceInStore,
  togglePaidInStore,
} from "@/stores/app/expense-commands";
import { updateMonthlySavingsContributionInStore } from "@/stores/app/finance-commands";
import { useMonthCloseSheet } from "../../hooks/use-month-close-sheet";
import { MonthCloseSheet } from "./MonthCloseSheet";

const initialStore: ExpenseStore = {
  ...emptyStore,
  finance: {
    ...emptyFinanceStore,
    monthlySavingsTargets: { "2026-09": 300 },
  },
  templates: [template("internet", "Internet", 20), template("gym", "Gimnasio", 30)],
};

function Harness({ onStart }: { onStart: () => void }) {
  const [store, setStore] = useState(initialStore);
  const sheet = useMonthCloseSheet({
    store,
    monthId: "2026-10",
    today: "2026-10-28",
    language: "es",
    commands: {
      togglePaid: (item) => setStore((current) => togglePaidInStore(current, item)),
      skipOccurrence: (item) => setStore((current) => skipOccurrenceInStore(current, item)),
      restoreOccurrence: (item) =>
        setStore((current) => restoreOccurrenceInStore(current, item)),
      moveOccurrence: (item, dueDate) =>
        setStore((current) => moveOccurrenceInStore(current, item, dueDate)),
      markOccurrencesPaid: (items) =>
        setStore((current) => markOccurrencesPaidInStore(current, items)),
      updateMonthlySavingsContribution: (input) =>
        setStore((current) => updateMonthlySavingsContributionInStore(current, input)),
    },
    onStart,
  });
  const leftovers = monthCloseStatus(
    occurrencesDueBetween(store, "2026-10-01", "2026-10-31"),
    "2026-10",
  ).leftovers;

  return sheet.isOpen && sheet.plan ? (
    <MonthCloseSheet
      monthId="2026-10"
      nextMonthId="2026-11"
      plan={sheet.plan}
      rows={sheet.rows}
      categories={[]}
      today="2026-10-28"
      language="es"
      savingsText={sheet.savingsText}
      savingsTarget={sheet.savingsTarget}
      savingsInvalid={sheet.savingsInvalid}
      onSavingsChange={sheet.setSavingsText}
      onClose={sheet.close}
      onPay={sheet.pay}
      onSkip={sheet.skip}
      onMove={sheet.move}
      onUndo={sheet.undo}
      onPayAll={sheet.payAll}
      onStart={sheet.start}
    />
  ) : (
    <button type="button" onClick={() => sheet.open(leftovers)}>
      Cerrar octubre
    </button>
  );
}

describe("MonthCloseSheet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("walks the four steps and keeps the focus on the row that was resolved", () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar octubre" }));

    const dialog = screen.getByRole("dialog", { name: "Cerrar octubre" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resumen frente al plan" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lo que queda" })).toBeInTheDocument();
    expect(screen.getByText("2 · 75,00 €")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pagado: Internet" }));
    const undo = screen.getByRole("button", { name: "Deshacer: Internet · Pagado" });
    expect(undo).toHaveFocus();
    expect(screen.getByText("1 · 45,00 €")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mover a noviembre: Gimnasio" }));
    expect(screen.getByText("Movido a noviembre")).toBeInTheDocument();
    expect(screen.getByText("Nada pendiente en octubre.")).toBeInTheDocument();

    fireEvent.click(undo);
    expect(screen.getByRole("button", { name: "Pagado: Internet" })).toHaveFocus();

    fireEvent.change(screen.getByLabelText("Ahorro real de octubre"), {
      target: { value: "120" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar noviembre" }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not start the month with an unreadable savings amount", () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar octubre" }));

    fireEvent.change(screen.getByLabelText("Ahorro real de octubre"), {
      target: { value: "doce" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Empezar noviembre" }));

    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByText(/Escribe un importe válido/)).toBeInTheDocument();
  });
});

function template(id: string, name: string, dueDay: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount: id === "gym" ? 45 : 30,
    currency: "EUR",
    categoryId: "home",
    startDate: "2026-10-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}
