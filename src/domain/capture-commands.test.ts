import { describe, expect, it } from "vitest";
import {
  normalizeCaptureCommand,
  rankTemplatesForTarget,
  resolveCaptureCommand,
  type CaptureCommand,
} from "./capture-commands";
import { emptyStore } from "./seed";
import type { ExpenseOccurrenceOverride, ExpenseStore, ExpenseTemplate } from "./types";

const TODAY = "2026-10-23";
const context = { today: TODAY, monthId: "2026-10" };

function template(id: string, name: string, extra: Partial<ExpenseTemplate> = {}): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description: "",
    amount: 60,
    currency: "EUR",
    categoryId: "casa",
    startDate: "2026-01-01",
    dueDay: 8,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

function override(templateId: string, occurrenceDate: string, extra: Partial<ExpenseOccurrenceOverride>) {
  return {
    id: `ovr:${templateId}:${occurrenceDate}`,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "due" as const,
    ...extra,
  };
}

const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    template("luz", "Luz"),
    template("netflix", "Netflix", { amount: 12.99, dueDay: 28 }),
    template("gym", "Gimnasio", { amount: 35, dueDay: 1 }),
    template("coche", "Seguro coche", {
      amount: 420,
      dueDay: 15,
      recurrence: { frequency: "yearly", annualMonth: 3 },
    }),
    template("hogar", "Seguro hogar", {
      amount: 180,
      dueDay: 20,
      recurrence: { frequency: "yearly", annualMonth: 6 },
    }),
    template("old", "Piscina", { active: false }),
  ],
};

const cmd = (intent: CaptureCommand["intent"], target: string, extra: Partial<CaptureCommand> = {}): CaptureCommand => ({
  intent,
  target,
  amount: null,
  day: null,
  date: null,
  month: null,
  ...extra,
});

describe("capture commands", () => {
  it("normalizes what the AI or the parser returns", () => {
    expect(
      normalizeCaptureCommand({ intent: "pay", name: " Luz ", amount: 71.204, dueDay: 4, startDate: "2026-10-01", annualMonth: 10 }),
    ).toEqual(cmd("pay", "Luz", { amount: 71.2, month: 10 }));
    expect(
      normalizeCaptureCommand({ intent: "move", name: "Netflix", amount: 5, dueDay: 40, startDate: "2026-11-31", annualMonth: 13 }),
    ).toEqual(cmd("move", "Netflix", { date: "2026-11-30" }));
    expect(normalizeCaptureCommand({ intent: "create", name: "Luz", amount: 1, dueDay: null, startDate: null, annualMonth: null })).toBeNull();
    expect(normalizeCaptureCommand({ intent: "skip", name: "  ", amount: null, dueDay: null, startDate: null, annualMonth: null })).toBeNull();
  });

  it("ranks series by how close their name is, ignoring finished ones", () => {
    const ranked = rankTemplatesForTarget("el seguro", store.templates).map((entry) => entry.template.name);
    expect(ranked.slice(0, 2)).toEqual(["Seguro coche", "Seguro hogar"]);
    expect(ranked).not.toContain("Piscina");
    expect(rankTemplatesForTarget("luz", store.templates)[0]).toMatchObject({ score: 100 });
    expect(rankTemplatesForTarget("gimnas", store.templates)[0].template.name).toBe("Gimnasio");
  });

  it("pays this month's charge with the amount said, or the planned one", () => {
    expect(resolveCaptureCommand(cmd("pay", "luz", { amount: 71.2 }), store, context)).toMatchObject({
      templateId: "luz",
      occurrence: { dueDate: "2026-10-08", status: "due" },
      amount: 71.2,
      issue: null,
    });
    expect(resolveCaptureCommand(cmd("pay", "Luz"), store, context).amount).toBe(60);
    expect(
      resolveCaptureCommand(cmd("pay", "luz", { month: 9 }), store, context).occurrence?.dueDate,
    ).toBe("2026-09-08");
  });

  it("knows when the charge is already paid or skipped", () => {
    const paid: ExpenseStore = {
      ...store,
      overrides: [
        override("luz", "2026-10-08", { status: "paid", amountPaid: 60 }),
        override("gym", "2026-10-01", { status: "skipped" }),
      ],
    };

    expect(resolveCaptureCommand(cmd("pay", "luz"), paid, context).issue).toBe("alreadyPaid");
    // Con otro importe se corrige lo pagado.
    expect(resolveCaptureCommand(cmd("pay", "luz", { amount: 71.2 }), paid, context).issue).toBeNull();
    expect(resolveCaptureCommand(cmd("skip", "gimnasio"), paid, context).issue).toBe("alreadySkipped");
    expect(resolveCaptureCommand(cmd("skip", "luz"), paid, context).issue).toBe("alreadyPaid");
    expect(resolveCaptureCommand(cmd("skip", "gimnasio"), store, context)).toMatchObject({
      occurrence: { dueDate: "2026-10-01" },
      issue: null,
    });
  });

  it("keeps what was paid on a variable bill when no amount is said", () => {
    const paid: ExpenseStore = {
      ...store,
      overrides: [override("luz", "2026-10-08", { status: "paid", amountPaid: 71.2 })],
    };

    expect(resolveCaptureCommand(cmd("pay", "luz"), paid, context)).toMatchObject({
      occurrence: { dueDate: "2026-10-08", status: "paid" },
      amount: 71.2,
      issue: "alreadyPaid",
    });
    expect(resolveCaptureCommand(cmd("pay", "luz", { amount: 71.2 }), paid, context)).toMatchObject({
      amount: 71.2,
      issue: "alreadyPaid",
    });
    // Otro importe corrige lo pagado.
    expect(resolveCaptureCommand(cmd("pay", "luz", { amount: 75 }), paid, context)).toMatchObject({
      amount: 75,
      issue: null,
    });
  });

  it("moves to a new day, offering the series only inside the same month", () => {
    expect(resolveCaptureCommand(cmd("move", "netflix", { day: 10 }), store, context)).toMatchObject({
      newDueDate: "2026-10-10",
      canMoveSeries: true,
      issue: null,
    });
    expect(
      resolveCaptureCommand(cmd("move", "netflix", { date: "2026-11-03" }), store, context),
    ).toMatchObject({ newDueDate: "2026-11-03", canMoveSeries: false, issue: null });
    expect(resolveCaptureCommand(cmd("move", "netflix", { day: 28 }), store, context).issue).toBe("sameDate");
    expect(resolveCaptureCommand(cmd("move", "netflix"), store, context).issue).toBe("missingDate");
    expect(
      resolveCaptureCommand(cmd("move", "luz", { date: "2026-09-30" }), store, context).issue,
    ).toBe("closedMonth");
  });

  it("moves within the same limits as the charge actions", () => {
    // Hasta el final del mes siguiente al abierto.
    expect(
      resolveCaptureCommand(cmd("move", "netflix", { date: "2026-11-30" }), store, context).issue,
    ).toBeNull();
    expect(
      resolveCaptureCommand(cmd("move", "netflix", { date: "2026-12-01" }), store, context).issue,
    ).toBe("tooFar");
    // Lo pagado de un mes cerrado es historial.
    const paidInSeptember: ExpenseStore = {
      ...store,
      overrides: [override("luz", "2026-09-08", { status: "paid", amountPaid: 60 })],
    };
    expect(
      resolveCaptureCommand(cmd("move", "luz", { date: "2026-10-12", month: 9 }), paidInSeptember, context).issue,
    ).toBe("closedMonth");
    // Con octubre cerrado, el mes abierto es noviembre.
    const octoberClosed: ExpenseStore = {
      ...store,
      finance: {
        ...store.finance,
        monthClosures: {
          "2026-10": { closedAt: "2026-10-20T10:00:00.000Z", updatedAt: "2026-10-20T10:00:00.000Z" },
        },
      },
    };
    expect(
      resolveCaptureCommand(cmd("move", "netflix", { date: "2026-10-30" }), octoberClosed, context).issue,
    ).toBe("closedMonth");
    expect(
      resolveCaptureCommand(cmd("move", "netflix", { date: "2026-12-10" }), octoberClosed, context).issue,
    ).toBeNull();
  });

  it("follows the payday cycle of Settings, like Gastos", () => {
    // Cobro el 25: "noviembre" va del 25 de octubre al 24 de noviembre.
    const paydayStore: ExpenseStore = {
      ...store,
      finance: {
        ...store.finance,
        monthlySalary: {
          "2026-09": { amount: 2000, dayOfMonth: 25, updatedAt: "2026-09-01T00:00:00.000Z" },
        },
        budgetCycle: { anchor: "payday", updatedAt: "2026-10-01T00:00:00.000Z" },
      },
    };
    const cycleContext = { today: "2026-10-26", monthId: "2026-11" };
    // El Netflix del 28 de octubre es el de "noviembre".
    expect(
      resolveCaptureCommand(cmd("pay", "netflix"), paydayStore, cycleContext).occurrence?.dueDate,
    ).toBe("2026-10-28");
    // Se mueve dentro del ciclo abierto, aunque caiga en octubre, pero no a
    // antes de que empiece.
    expect(
      resolveCaptureCommand(cmd("move", "netflix", { date: "2026-10-27" }), paydayStore, cycleContext).issue,
    ).toBeNull();
    expect(
      resolveCaptureCommand(cmd("move", "netflix", { date: "2026-10-24" }), paydayStore, cycleContext).issue,
    ).toBe("closedMonth");
  });

  it("asks which one when the name is ambiguous or unknown", () => {
    expect(resolveCaptureCommand(cmd("pay", "seguro"), store, context)).toMatchObject({
      templateId: null,
      issue: "ambiguous",
      candidates: expect.arrayContaining(["coche", "hogar"]),
    });
    expect(resolveCaptureCommand(cmd("pay", "agua"), store, context)).toMatchObject({
      templateId: null,
      issue: "notFound",
    });
  });

  it("uses the series chosen by hand and finds its nearest charge", () => {
    expect(
      resolveCaptureCommand(cmd("pay", "seguro"), store, { ...context, templateId: "coche" }),
    ).toMatchObject({
      templateId: "coche",
      occurrence: { dueDate: "2027-03-15" },
      amount: 420,
      issue: null,
    });
    // Un mes dicho sin cobro en él no busca otro.
    expect(
      resolveCaptureCommand(cmd("pay", "seguro coche", { month: 10 }), store, context).issue,
    ).toBe("noOccurrence");
  });
});
