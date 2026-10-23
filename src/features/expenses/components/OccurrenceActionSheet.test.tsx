import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { generateStoreOccurrences } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { SeriesAmountPrompt } from "@/domain/series-lifecycle";
import type { ExpenseStore } from "@/domain/types";
import { OccurrenceActionSheet } from "./OccurrenceActionSheet";

const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    {
      id: "luz",
      userId: "demo",
      name: "Luz",
      description: "",
      amount: 60,
      currency: "EUR",
      categoryId: "cat",
      startDate: "2026-10-08",
      dueDay: 8,
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
};
const occurrence = generateStoreOccurrences(store, "2026-10-01", "2026-10-31")[0];
const prompt: SeriesAmountPrompt = { templateId: "luz", name: "Luz", from: 60, to: 74.3 };

function renderSheet(
  seriesPromptFor = vi.fn((): SeriesAmountPrompt | null => prompt),
) {
  const handlers = {
    onClose: vi.fn(),
    onPayAmount: vi.fn(),
    onApplySeries: vi.fn(),
    seriesPromptFor,
  };
  render(
    <OccurrenceActionSheet
      occurrence={occurrence}
      minMoveDate="2026-10-01"
      maxMoveDate="2026-11-30"
      canMove
      language="es"
      onTogglePaid={vi.fn()}
      onMove={vi.fn()}
      onSkip={vi.fn()}
      onEditSeries={vi.fn()}
      suggestion={{ amount: 72, count: 2 }}
      {...handlers}
    />,
  );
  const sheet = screen.getByRole("dialog", { name: "Luz" });
  fireEvent.click(within(sheet).getByRole("button", { name: "Pagado con otro importe" }));
  return { sheet, ...handlers };
}

describe("OccurrenceActionSheet paying another amount", () => {
  it("suggests the average of the last payments", () => {
    const { sheet } = renderSheet();

    fireEvent.click(within(sheet).getByRole("button", { name: /Media de los 2 últimos: 72,00/ }));

    expect(within(sheet).getByLabelText("Importe cobrado")).toHaveValue("72");
  });

  it("asks to update the series after paying a different amount", () => {
    const { sheet, onPayAmount, onApplySeries, onClose, seriesPromptFor } = renderSheet();

    fireEvent.change(within(sheet).getByLabelText("Importe cobrado"), {
      target: { value: "74,30" },
    });
    fireEvent.submit(within(sheet).getByRole("button", { name: "Guardar pago" }));

    expect(onPayAmount).toHaveBeenCalledWith(occurrence, 74.3);
    expect(seriesPromptFor).toHaveBeenCalledWith(occurrence, 74.3);
    expect(onClose).not.toHaveBeenCalled();
    expect(
      within(sheet).getByRole("heading", { name: "¿Actualizar el importe desde ahora?" }),
    ).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "Actualizar" }));
    expect(onApplySeries).toHaveBeenCalledWith(prompt);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes without asking when the planned amount is paid or there is nothing to update", () => {
    const { sheet, onPayAmount, onClose, seriesPromptFor } = renderSheet(vi.fn((): SeriesAmountPrompt | null => null));

    fireEvent.change(within(sheet).getByLabelText("Importe cobrado"), {
      target: { value: "61" },
    });
    fireEvent.submit(within(sheet).getByRole("button", { name: "Guardar pago" }));

    expect(onPayAmount).toHaveBeenCalledWith(occurrence, 61);
    expect(seriesPromptFor).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
