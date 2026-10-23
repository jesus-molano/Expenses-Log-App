import { describe, expect, it } from "vitest";
import { thinkingConfigFor } from "./gemini-client";
import {
  buildCaptureResponseSchema,
  buildCaptureSystemInstruction,
  parseCaptureResponse,
} from "./expense-capture-prompt";

describe("Gemini expense capture contract", () => {
  it("uses only schema keywords Gemini accepts", () => {
    const schema = JSON.stringify(buildCaptureResponseSchema(["Casa", "General"]));

    for (const keyword of ["minLength", "maxLength", "pattern", "exclusiveMinimum", "$schema", "additionalProperties"]) {
      expect(schema).not.toContain(`"${keyword}"`);
    }
    expect(buildCaptureResponseSchema(["Casa"])).toMatchSnapshot();
  });

  it("gives the model today's date, weekday and the allowed categories", () => {
    const instruction = buildCaptureSystemInstruction({
      today: "2026-10-23",
      language: "en",
      categories: ["Casa", "Viajes"],
    });

    expect(instruction).toContain("Hoy es 2026-10-23 (viernes)");
    expect(instruction).toContain("Casa, Viajes");
    expect(instruction).toContain("inglés");
    expect(instruction).toContain("Nunca inventes importes");
  });

  it("leaves an unstated frequency as null so the app flags it", () => {
    const instruction = buildCaptureSystemInstruction({
      today: "2026-10-23",
      language: "es",
      categories: ["Casa"],
    });

    expect(instruction).toContain("Si no se dice, null");
    expect(instruction).not.toContain("Si no se dice, monthly");
    // El ejemplo "Netflix 12,99 el 5" no dice la frecuencia.
    expect(instruction).toMatch(/"name":"Netflix"[^}]*"frequency":null/);
  });

  it("keeps usable items and drops the rest", () => {
    expect(
      parseCaptureResponse({
        expenses: [
          { name: "Luz", amount: "60", frequency: "weekly", dueDay: 8 },
          { name: "", amount: null },
          42,
        ],
      }),
    ).toEqual({
      items: [
        expect.objectContaining({ name: "Luz", amount: null, frequency: null, dueDay: 8 }),
      ],
      droppedCount: 2,
    });
    expect(parseCaptureResponse({ nope: true })).toBeNull();
  });

  it("asks for an intent and explains orders on existing expenses", () => {
    const schema = buildCaptureResponseSchema(["Casa"]);
    const item = schema.properties.expenses.items;
    expect(item.properties.intent).toEqual({
      type: "string",
      enum: ["create", "pay", "skip", "move"],
    });
    expect(item.required[0]).toBe("intent");

    const instruction = buildCaptureSystemInstruction({
      today: "2026-10-23",
      language: "es",
      categories: ["Casa"],
      expenseNames: ["Luz", "Netflix"],
    });
    expect(instruction).toContain("Gastos que ya tiene el usuario: Luz, Netflix.");
    expect(instruction).toContain("marca la luz pagada 71,20");
    expect(instruction).toMatch(/"intent":"move","name":"Netflix"[^}]*"dueDay":10/);
    expect(
      buildCaptureSystemInstruction({ today: "2026-10-23", language: "es", categories: [] }),
    ).toContain("El usuario aún no tiene gastos guardados.");
  });

  it("reads intents, treating a missing or unknown one as a new expense", () => {
    expect(
      parseCaptureResponse({
        expenses: [
          { name: "Luz", amount: 60 },
          { intent: "pay", name: "Luz", amount: 71.2 },
          { intent: "teleport", name: "Gimnasio", amount: 35 },
          { intent: "skip", name: null, amount: null },
        ],
      }),
    ).toEqual({
      items: [
        expect.objectContaining({ intent: "create", name: "Luz", amount: 60 }),
        expect.objectContaining({ intent: "pay", name: "Luz", amount: 71.2 }),
        expect.objectContaining({ intent: "create", name: "Gimnasio" }),
      ],
      droppedCount: 1,
    });
  });

  it("chooses the thinking setting by model family", () => {
    expect(thinkingConfigFor("gemini-3.5-flash-lite")).toEqual({ thinkingLevel: "MINIMAL" });
    expect(thinkingConfigFor("gemini-3.1-flash-lite")).toEqual({ thinkingLevel: "MINIMAL" });
    expect(thinkingConfigFor("gemini-3.8-flash")).toEqual({ thinkingLevel: "LOW" });
    expect(thinkingConfigFor("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfigFor("gemini-2.5-flash-lite")).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfigFor("gemini-4-argon")).toBeUndefined();
  });
});
