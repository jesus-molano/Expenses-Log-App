import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  deepLinkViewMonth,
  locateOccurrence,
  occurrenceDeepLink,
  readOccurrenceParam,
  urlWithoutOccurrenceParam,
} from "./occurrence-deep-link";

const rent: ExpenseTemplate = {
  id: "exp-rent",
  userId: "user",
  name: "Alquiler",
  description: "",
  amount: 700,
  currency: "EUR",
  categoryId: "home",
  startDate: "2026-09-01",
  dueDay: 1,
  recurrence: { frequency: "monthly" },
  active: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const store: ExpenseStore = {
  ...emptyStore,
  templates: [rent],
  overrides: [
    {
      id: "ovr:exp-rent:2026-11-01",
      userId: "user",
      templateId: "exp-rent",
      occurrenceDate: "2026-11-01",
      dueDate: "2026-10-28",
      status: "due",
    },
  ],
};

describe("occurrence deep links", () => {
  it("round-trips the occurrence id through the URL", () => {
    const link = occurrenceDeepLink("exp-rent:2026-11-01");
    expect(link).toBe("/?occurrence=exp-rent%3A2026-11-01");
    expect(readOccurrenceParam(link.slice(1))).toBe("exp-rent:2026-11-01");
  });

  it("ignores malformed ids", () => {
    expect(readOccurrenceParam("?occurrence=nope")).toBeNull();
    expect(readOccurrenceParam("?occurrence=exp:2026-13-40")).toBeNull();
    expect(readOccurrenceParam("?other=1")).toBeNull();
  });

  it("removes only the occurrence parameter", () => {
    expect(
      urlWithoutOccurrenceParam({
        pathname: "/",
        search: "?occurrence=exp%3A2026-10-01&from=money",
        hash: "#top",
      }),
    ).toBe("/?from=money#top");
    expect(
      urlWithoutOccurrenceParam({ pathname: "/", search: "?occurrence=x", hash: "" }),
    ).toBe("/");
  });

  it("finds an occurrence, also when it was moved to another day", () => {
    expect(locateOccurrence(store, "exp-rent:2026-10-01")?.dueDate).toBe("2026-10-01");
    expect(locateOccurrence(store, "exp-rent:2026-11-01")?.dueDate).toBe("2026-10-28");
    expect(locateOccurrence(store, "exp-gone:2026-10-01")).toBeNull();
    expect(locateOccurrence(store, "exp-rent:2026-10-15")).toBeNull();
  });

  it("stays on the current month when the charge is already listed", () => {
    const occurrence = { id: "exp-rent:2026-09-01", dueDate: "2026-09-01" };
    expect(deepLinkViewMonth(occurrence, "2026-10", new Set([occurrence.id]))).toBe("2026-10");
    expect(deepLinkViewMonth(occurrence, "2026-10", new Set())).toBe("2026-09");
  });
});
