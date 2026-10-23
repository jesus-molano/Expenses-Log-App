import { describe, expect, it } from "vitest";
import { resolveCaptureCommand, type CaptureCommand } from "@/domain/capture-commands";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import {
  commandDetailLabel,
  commandIntentLabel,
  commandIssueLabel,
} from "./capture-command-labels";

const store: ExpenseStore = {
  ...emptyStore,
  templates: [
    {
      id: "netflix",
      userId: "demo",
      name: "Netflix",
      description: "",
      amount: 12.99,
      currency: "EUR",
      categoryId: "subs",
      startDate: "2026-01-01",
      dueDay: 28,
      recurrence: { frequency: "monthly" },
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

const cmd = (intent: CaptureCommand["intent"], extra: Partial<CaptureCommand> = {}): CaptureCommand => ({
  intent,
  target: "netflix",
  amount: null,
  day: null,
  date: null,
  month: null,
  ...extra,
});

const resolve = (command: CaptureCommand) =>
  resolveCaptureCommand(command, store, { today: "2026-10-23", monthId: "2026-10" });

describe("capture command labels", () => {
  it("describes each order", () => {
    expect(commandIntentLabel("pay", "es")).toBe("Marcar como pagado");
    // Intl separa el símbolo con un espacio duro.
    expect(commandDetailLabel(resolve(cmd("pay", { amount: 13.5 })), "es")).toMatch(
      /^13,50\s€ · vence el 28 oct$/,
    );
    expect(commandDetailLabel(resolve(cmd("skip")), "en")).toBe("Charge on 28 Oct");
    expect(commandDetailLabel(resolve(cmd("move", { day: 10 })), "es")).toBe("Del 28 oct al 10 oct");
    expect(commandDetailLabel(resolve(cmd("move")), "es")).toBe("");
  });

  it("explains why an order cannot be applied", () => {
    expect(commandIssueLabel("notFound", cmd("pay", { target: "agua" }), "2026-10", "es")).toBe(
      "No encuentro «agua». Elige el gasto:",
    );
    expect(commandIssueLabel("noOccurrence", cmd("pay", { month: 3 }), "2026-10", "es")).toBe(
      "No tiene cobros en marzo.",
    );
  });
});
