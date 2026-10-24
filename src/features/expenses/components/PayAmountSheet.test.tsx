import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateStoreOccurrences } from "@/domain/finance";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { PayAmountSheet } from "./PayAmountSheet";

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

// Como el historial de cobros: un botón "Pagar" abre la hoja.
function Harness() {
  const [open, setOpen] = useState(false);
  const [amountText, setAmountText] = useState("");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Pagar
      </button>
      {open ? (
        <PayAmountSheet
          occurrence={occurrence}
          amountText={amountText}
          suggestion={null}
          seriesPrompt={null}
          language="es"
          today="2026-10-08"
          onAmountTextChange={setAmountText}
          onSubmit={(event) => event.preventDefault()}
          onApplySeries={vi.fn()}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

describe("PayAmountSheet focus", () => {
  beforeEach(() => {
    // El foco inicial de la hoja va en el siguiente frame: aquí, en el acto.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["Escape", () => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })],
    ["Cerrar", () => fireEvent.click(screen.getByRole("button", { name: "Cerrar" }))],
  ])("starts on the amount and returns the focus to the opener after %s", (_label, close) => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Pagar" });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByLabelText("Lo que pagaste")).toHaveFocus();

    close();
    expect(screen.queryByRole("dialog", { name: "Importe pagado" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
