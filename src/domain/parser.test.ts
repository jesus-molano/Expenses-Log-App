import { describe, expect, it } from "vitest";
import { parseExpenseTextLocally } from "./parser";

describe("parseExpenseTextLocally", () => {
  it("extracts amount, due day, category, tags and monthly recurrence", () => {
    const [expense] = parseExpenseTextLocally(
      "Netflix 15,99 mensual el dia 12 entretenimiento",
    );

    expect(expense).toMatchObject({
      amount: 15.99,
      dueDay: 12,
      categoryName: "Suscripciones",
      recurrence: { frequency: "monthly" },
    });
    expect(expense.tags).toContain("sub");
  });

  it("detects custom recurrence", () => {
    const [expense] = parseExpenseTextLocally("Parking 20 cada 2 semanas el 3");

    expect(expense.recurrence).toMatchObject({
      frequency: "custom",
      interval: 2,
      unit: "week",
    });
  });
});
