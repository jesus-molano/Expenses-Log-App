import { describe, expect, it } from "vitest";
import { toDateOnly } from "@/domain/calendar";
import { createEmptyDraft } from "./dashboard-config";

describe("createEmptyDraft", () => {
  it("uses today's local date as the default start date", () => {
    const today = new Date();
    const draft = createEmptyDraft();

    expect(draft.startDate).toBe(toDateOnly(today));
    expect(draft.dueDay).toBe(today.getDate());
  });
});
