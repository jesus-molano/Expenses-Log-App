import { describe, expect, it } from "vitest";
import { toDateOnly } from "./calendar";
import { parseExpenseTextLocally } from "./parser";

describe("parseExpenseTextLocally", () => {
  it("extracts amount, due day, category and monthly recurrence", () => {
    const [expense] = parseExpenseTextLocally(
      "Netflix 15,99 mensual el dia 12 entretenimiento",
    );

    expect(expense).toMatchObject({
      amount: 15.99,
      dueDay: 12,
      categoryName: "Suscripciones",
      recurrence: { frequency: "monthly" },
    });
  });

  it("detects custom recurrence", () => {
    const [expense] = parseExpenseTextLocally("Parking 20 cada 2 semanas el 3");

    expect(expense.recurrence).toMatchObject({
      frequency: "custom",
      interval: 2,
      unit: "week",
    });
  });

  it("detects one-time expenses", () => {
    const [expense] = parseExpenseTextLocally("Seguro coche 450 puntual el 12");

    expect(expense).toMatchObject({
      amount: 450,
      dueDay: 12,
      categoryName: "Vehiculo",
      recurrence: { frequency: "once" },
    });
    expect(expense.startDate).toBe(toDateOnly(new Date()));
  });
});
