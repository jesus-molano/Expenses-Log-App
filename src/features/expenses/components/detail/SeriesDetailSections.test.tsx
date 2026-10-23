import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  endSeriesInStore,
  pauseSeriesInStore,
  payOccurrenceInStore,
  reactivateSeriesInStore,
  removeAmountChangeInStore,
  removePauseInStore,
  resumeSeriesInStore,
  scheduleAmountChangeInStore,
  setSeriesAmountInStore,
} from "@/stores/app/store-commands";
import type { useExpenseStore } from "@/stores/app/use-expense-store";
import { SeriesDetailSections } from "./SeriesDetailSections";

const NOW = new Date("2026-10-23T10:00:00");

const gym: ExpenseTemplate = {
  id: "gym",
  userId: "demo",
  name: "Gimnasio",
  description: "",
  amount: 35,
  currency: "EUR",
  categoryId: "cat",
  startDate: "2026-06-05",
  dueDay: 5,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const initialStore: ExpenseStore = {
  ...emptyStore,
  templates: [gym],
  overrides: [
    {
      id: "ovr:gym:2026-09-05",
      userId: "demo",
      templateId: "gym",
      occurrenceDate: "2026-09-05",
      status: "paid",
      paidAt: "2026-09-05T09:00:00.000Z",
      amountPaid: 38,
    },
  ],
};

// Los comandos de verdad sobre un estado local, como hace el store de la app.
function DetailHarness() {
  const [store, setStore] = useState(initialStore);
  const apply =
    <Args extends unknown[]>(command: (store: ExpenseStore, ...args: Args) => ExpenseStore) =>
    (...args: Args) =>
      setStore((current) => command(current, ...args));
  const expenseStore = {
    store,
    endSeries: apply(endSeriesInStore),
    reactivateSeries: apply(reactivateSeriesInStore),
    pauseSeries: apply(pauseSeriesInStore),
    resumeSeries: apply(resumeSeriesInStore),
    removePause: apply(removePauseInStore),
    scheduleAmountChange: apply(scheduleAmountChangeInStore),
    removeAmountChange: apply(removeAmountChangeInStore),
    payOccurrence: apply(payOccurrenceInStore),
    setSeriesAmount: (templateId: string, amount: number) =>
      setStore((current) => setSeriesAmountInStore(current, templateId, amount)),
  } as unknown as ReturnType<typeof useExpenseStore>;

  return (
    <SeriesDetailSections
      template={store.templates[0]}
      expenseStore={expenseStore}
      language="es"
      now={NOW}
    />
  );
}

describe("SeriesDetailSections", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pauses until a chosen charge and removes the scheduled pause", () => {
    render(<DetailHarness />);
    const card = screen.getByRole("region", { name: "Suscripción" });

    fireEvent.click(within(card).getByRole("button", { name: "Pausar" }));
    const sheet = screen.getByRole("dialog", { name: "Pausar Gimnasio" });
    expect(
      within(sheet).getByRole("radio", { name: "5 oct" }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(sheet).getByRole("radio", { name: "5 nov" }));
    fireEvent.click(within(sheet).getByRole("radio", { name: "Vuelve el 5 ene 2027" }));
    expect(within(sheet).getByText("Se saltan 2 cobros.")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Pausar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(card).toHaveTextContent(
      "Pausa programada desde el cobro del 5 nov · vuelve el 5 ene 2027.",
    );
    fireEvent.click(within(card).getByRole("button", { name: "Quitar pausa" }));
    expect(card).toHaveTextContent("Activa.");
  });

  it("finishes after a chosen charge and reactivates", () => {
    render(<DetailHarness />);
    const card = screen.getByRole("region", { name: "Suscripción" });

    fireEvent.click(within(card).getByRole("button", { name: "Finalizar" }));
    const sheet = screen.getByRole("dialog", { name: "Finalizar Gimnasio" });
    expect(within(sheet).getByRole("radio", { name: /5 sep/ })).toHaveTextContent("Pagado");
    fireEvent.click(within(sheet).getByRole("radio", { name: "5 dic" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Finalizar tras ese cobro" }));

    expect(card).toHaveTextContent("Termina tras el cobro del 5 dic.");
    fireEvent.click(within(card).getByRole("button", { name: "Reactivar" }));
    expect(within(card).getByRole("button", { name: "Finalizar" })).toBeInTheDocument();
  });

  it("schedules and removes a price change", () => {
    render(<DetailHarness />);
    const price = screen.getByRole("region", { name: "Precio" });

    fireEvent.click(within(price).getByRole("button", { name: "Programar cambio de precio" }));
    const sheet = screen.getByRole("dialog", { name: "Cambio de precio · Gimnasio" });
    fireEvent.click(within(sheet).getByRole("radio", { name: "mar 2027" }));
    fireEvent.change(within(sheet).getByLabelText("Nuevo importe"), {
      target: { value: "39,90" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "Programar" }));

    expect(price).toHaveTextContent("Desde mar 2027");
    expect(price).toHaveTextContent("Programado");
    fireEvent.click(
      within(price).getByRole("button", { name: "Quitar el cambio de precio de mar 2027" }),
    );
    expect(price).not.toHaveTextContent("Programado");
  });

  it("pays a charge with another amount and updates the series from now on", () => {
    render(<DetailHarness />);
    const history = screen.getByRole("region", { name: "Últimos cobros" });

    fireEvent.click(within(history).getByRole("button", { name: "Pagar el cobro del 5 oct" }));
    const sheet = screen.getByRole("dialog", { name: "Importe pagado" });
    expect(within(sheet).getByRole("button", { name: /Último pago: 38,00/ })).toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText("Lo que pagaste"), {
      target: { value: "39" },
    });
    fireEvent.submit(within(sheet).getByRole("button", { name: "Guardar pago" }));

    expect(within(sheet).getByRole("heading", { name: "¿Actualizar el importe desde ahora?" }))
      .toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Actualizar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Precio" })).toHaveTextContent(/Ahora 39,00/);
    expect(history).toHaveTextContent(/previsto 35,00/);
  });
});
