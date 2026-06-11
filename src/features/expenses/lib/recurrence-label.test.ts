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
});
