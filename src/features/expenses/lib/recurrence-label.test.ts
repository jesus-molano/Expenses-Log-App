import { describe, expect, it } from "vitest";
import { localizedRecurrenceLabel } from "./recurrence-label";

describe("localizedRecurrenceLabel", () => {
  it("translates recurrence labels", () => {
    expect(localizedRecurrenceLabel({ frequency: "monthly" }, "es")).toBe(
      "Mensual",
    );
    expect(localizedRecurrenceLabel({ frequency: "yearly" }, "en")).toBe(
      "Yearly",
    );
  });

  it("names one-off and advanced rules instead of showing the raw id", () => {
    expect(localizedRecurrenceLabel({ frequency: "once" }, "es")).toBe("Pago único");
    expect(localizedRecurrenceLabel({ frequency: "once" }, "en")).toBe("One-time");
    expect(
      localizedRecurrenceLabel({ frequency: "rrule", rrule: "FREQ=WEEKLY" }, "es"),
    ).toBe("Avanzada");
  });

  it("spells out custom intervals in both languages", () => {
    expect(
      localizedRecurrenceLabel({ frequency: "custom", interval: 2, unit: "week" }, "es"),
    ).toBe("Cada 2 semanas");
    expect(
      localizedRecurrenceLabel({ frequency: "custom", interval: 1, unit: "day" }, "es"),
    ).toBe("Cada día");
    expect(
      localizedRecurrenceLabel({ frequency: "custom", interval: 6, unit: "month" }, "en"),
    ).toBe("Every 6 months");
    expect(localizedRecurrenceLabel({ frequency: "custom" }, "en")).toBe("Every month");
  });
});
