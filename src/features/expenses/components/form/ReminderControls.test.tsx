import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_PREFERENCES } from "@/domain/reminder-schedule";
import type { DraftExpense } from "@/domain/types";
import { ExpenseSchedulePicker } from "./ExpenseSchedulePicker";
import { ReminderControls } from "./ReminderControls";

function Harness({ initial }: { initial: DraftExpense }) {
  const [draft, setDraft] = useState(initial);
  return (
    <>
      <ExpenseSchedulePicker value={draft} onChange={setDraft} language="es" />
      <ReminderControls
        value={draft}
        preferences={DEFAULT_REMINDER_PREFERENCES}
        language="es"
        onChange={setDraft}
      />
    </>
  );
}

describe("ReminderControls", () => {
  it("keeps a lead pressed after switching a yearly expense to monthly", () => {
    render(
      <Harness
        initial={{
          name: "Seguro",
          description: "",
          amount: 420,
          categoryName: "General",
          startDate: "2026-03-15",
          dueDay: 15,
          recurrence: { frequency: "yearly", annualMonth: 3 },
          reminder: { enabled: true, daysBeforeCharge: 30 },
        }}
      />,
    );

    const leads = () => screen.getByRole("group", { name: "Días de antelación" });
    expect(within(leads()).getByRole("button", { name: "30 días" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Mensual" }));

    expect(within(leads()).getByRole("button", { name: "5 días" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
