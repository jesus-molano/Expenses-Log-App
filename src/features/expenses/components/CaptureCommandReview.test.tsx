import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CaptureCommand } from "@/domain/capture-commands";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { CaptureCommandReview } from "./CaptureCommandReview";

function template(id: string, name: string, dueDay: number): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount: 100,
    currency: "EUR",
    categoryId: "casa",
    startDate: "2026-01-01",
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const store: ExpenseStore = {
  ...emptyStore,
  templates: [template("coche", "Seguro coche", 15), template("hogar", "Seguro hogar", 20)],
};

const pay = (target: string): CaptureCommand => ({
  intent: "pay",
  target,
  amount: null,
  day: null,
  date: null,
  month: null,
});

// Las clases del design system, para que getComputedStyle vea el overflow
// real de las tarjetas.
const styles = document.createElement("style");
beforeAll(() => {
  styles.textContent = readFileSync(
    join(process.cwd(), "src/app/styles/components.css"),
    "utf8",
  );
  document.head.append(styles);
});
afterAll(() => styles.remove());

function renderReview(command: CaptureCommand) {
  const onApply = vi.fn();
  render(
    <CaptureCommandReview
      commands={[command]}
      pendingDrafts={0}
      store={store}
      today="2026-10-23"
      monthId="2026-10"
      notice={null}
      language="es"
      onApply={onApply}
      onClose={vi.fn()}
    />,
  );
  return { onApply, sheet: screen.getByRole("dialog") };
}

// Ningún contenedor entre el desplegable y la hoja (que tiene su propio
// scroll) puede recortarlo: quedaría invisible y sin poder tocarse.
function expectNotClipped(listbox: HTMLElement, sheet: HTMLElement) {
  for (let node = listbox.parentElement; node && node !== sheet; node = node.parentElement) {
    expect(["hidden", "clip", "auto", "scroll"]).not.toContain(getComputedStyle(node).overflow);
  }
}

describe("CaptureCommandReview", () => {
  it.each([
    ["ambiguous", "seguro"],
    ["notFound", "gimnasio"],
  ])("lets the expense be chosen when the name is %s", (_issue, target) => {
    const { onApply, sheet } = renderReview(pay(target));
    const apply = within(sheet).getByRole("button", { name: "Aplicar 0" });
    expect(apply).toBeDisabled();

    fireEvent.click(within(sheet).getByRole("button", { name: "Elegir gasto" }));
    const listbox = within(sheet).getByRole("listbox");
    expectNotClipped(listbox, sheet);

    fireEvent.click(within(listbox).getByRole("option", { name: "Seguro hogar" }));
    const applyOne = within(sheet).getByRole("button", { name: "Aplicar 1" });
    expect(applyOne).toBeEnabled();
    fireEvent.click(applyOne);
    expect(onApply).toHaveBeenCalledWith([
      expect.objectContaining({ resolved: expect.objectContaining({ templateId: "hogar" }) }),
    ]);
  });
});
