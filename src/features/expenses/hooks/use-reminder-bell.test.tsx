import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseOccurrence, ExpenseStore, ExpenseTemplate } from "@/domain/types";
import { useReminderBell } from "./use-reminder-bell";

const netflix: ExpenseTemplate = {
  id: "exp-netflix",
  userId: "user",
  name: "Netflix",
  description: "",
  amount: 12.99,
  currency: "EUR",
  categoryId: "subs",
  startDate: "2026-09-05",
  dueDay: 5,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const store: ExpenseStore = { ...emptyStore, templates: [netflix] };

// Cobro de un mes cerrado: llega como registro, con una copia inactiva.
const recordOccurrence = {
  id: "exp-netflix:2026-09-05",
  template: { ...netflix, active: false, reminder: undefined },
  status: "due",
} as unknown as ExpenseOccurrence;

function render() {
  const setTemplateReminder = vi.fn();
  const showToast = vi.fn();
  const dismissToast = vi.fn();
  const { result } = renderHook(() =>
    useReminderBell({ store, language: "es", setTemplateReminder, showToast, dismissToast }),
  );
  return { result, setTemplateReminder, showToast, dismissToast };
}

describe("useReminderBell", () => {
  it("reads the reminder of the live series, also for closed-month charges", () => {
    const { result } = render();

    expect(result.current.reminderFor(recordOccurrence)).toMatchObject({
      enabled: false,
      source: "default",
    });
    expect(
      result.current.reminderFor({
        ...recordOccurrence,
        template: { ...netflix, id: "exp-deleted" },
      }),
    ).toBeNull();
  });

  it("turns the reminder on with a toast that undoes it", () => {
    const { result, setTemplateReminder, showToast, dismissToast } = render();

    result.current.onToggle(recordOccurrence);

    expect(setTemplateReminder).toHaveBeenCalledWith("exp-netflix", {
      enabled: true,
      daysBeforeCharge: 3,
    });
    const toast = showToast.mock.calls[0][0];
    expect(toast.message).toMatch(/^Te avisaré de Netflix 3 días antes\./);
    toast.onAction();
    expect(setTemplateReminder).toHaveBeenLastCalledWith("exp-netflix", undefined);
    expect(dismissToast).toHaveBeenCalled();
  });
});
