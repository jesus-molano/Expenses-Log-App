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

  it("chooses the thinking setting by model family", () => {
    expect(thinkingConfigFor("gemini-3.5-flash-lite")).toEqual({ thinkingLevel: "MINIMAL" });
    expect(thinkingConfigFor("gemini-3.1-flash-lite")).toEqual({ thinkingLevel: "MINIMAL" });
    expect(thinkingConfigFor("gemini-3.8-flash")).toEqual({ thinkingLevel: "LOW" });
    expect(thinkingConfigFor("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfigFor("gemini-2.5-flash-lite")).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfigFor("gemini-4-argon")).toBeUndefined();
  });
});
