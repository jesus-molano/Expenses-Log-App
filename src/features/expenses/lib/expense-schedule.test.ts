import { describe, expect, it } from "vitest";
import type { DraftExpense } from "@/domain/types";
import {
  updateDraftCustomInterval,
  updateDraftCustomUnit,
  updateDraftRecurrence,
} from "./expense-schedule";

const yearly: DraftExpense = {
  name: "Seguro",
  description: "",
  amount: 420,
  categoryName: "General",
  startDate: "2026-03-15",
  dueDay: 15,
  recurrence: { frequency: "yearly", annualMonth: 3 },
  reminder: { enabled: true, daysBeforeCharge: 30 },
};

describe("expense schedule", () => {
  it("moves the expense's own reminder to a lead the new frequency offers", () => {
    const monthly = updateDraftRecurrence(yearly, "monthly");
    expect(monthly.recurrence).toEqual({ frequency: "monthly" });
    expect(monthly.reminder).toEqual({ enabled: true, daysBeforeCharge: 5 });

    // Una antelación que ambas ofrecen se queda como está.
    const threeDays = { ...yearly, reminder: { enabled: false, daysBeforeCharge: 3 } };
    expect(updateDraftRecurrence(threeDays, "monthly").reminder).toEqual({
      enabled: false,
      daysBeforeCharge: 3,
    });
  });

  it("does the same when a custom cycle becomes short", () => {
    const custom = updateDraftRecurrence(yearly, "custom");
    expect(custom.recurrence).toMatchObject({ frequency: "custom", interval: 1, unit: "month" });
    expect(custom.reminder?.daysBeforeCharge).toBe(5);

    const quarterly = { ...yearly, recurrence: { frequency: "custom" as const, interval: 3, unit: "month" as const } };
    expect(updateDraftCustomInterval(quarterly, 2).reminder?.daysBeforeCharge).toBe(5);
    expect(updateDraftCustomUnit(quarterly, "week").reminder?.daysBeforeCharge).toBe(5);
    expect(updateDraftCustomUnit(quarterly, "year").reminder?.daysBeforeCharge).toBe(30);
  });

  it("leaves an expense that follows the default reminder without one", () => {
    const followsDefault: DraftExpense = { ...yearly, reminder: undefined };
    expect(updateDraftRecurrence(followsDefault, "monthly").reminder).toBeUndefined();
  });
});
