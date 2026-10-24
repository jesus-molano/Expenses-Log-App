import { describe, expect, it } from "vitest";
import {
  commitmentStatus,
  isValidCancellationUrlInput,
  normalizeCancellationUrl,
  sanitizeExpenseDetails,
} from "./expense-details";

describe("cancellation URL", () => {
  it("accepts http(s) links and completes bare domains with https", () => {
    expect(normalizeCancellationUrl("https://www.netflix.com/cancelplan")).toBe(
      "https://www.netflix.com/cancelplan",
    );
    expect(normalizeCancellationUrl("  netflix.com/cancel ")).toBe("https://netflix.com/cancel");
    expect(normalizeCancellationUrl("www.vodafone.es")).toBe("https://www.vodafone.es/");
    expect(normalizeCancellationUrl("http://localhost:3000/baja")).toBe("http://localhost:3000/baja");
  });

  it("rejects scripts, other schemes and text that is not a link", () => {
    for (const value of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,hi",
      "mailto:baja@gym.es",
      "ftp://files.example.com",
      "hola",
      "llamar al 900 100 200",
      "",
      42,
      null,
    ]) {
      expect(normalizeCancellationUrl(value)).toBeUndefined();
    }
    expect(normalizeCancellationUrl(`https://x.com/${"a".repeat(600)}`)).toBeUndefined();
  });

  it("treats an empty field as valid input but not a broken link", () => {
    expect(isValidCancellationUrlInput("")).toBe(true);
    expect(isValidCancellationUrlInput("gym.es/baja")).toBe(true);
    expect(isValidCancellationUrlInput("no es un enlace")).toBe(false);
  });
});

describe("sanitizeExpenseDetails", () => {
  it("keeps valid details and drops empty or unreadable ones", () => {
    expect(
      sanitizeExpenseDetails({
        notes: "  Contrato 12 meses  ",
        cancellationUrl: "javascript:alert(1)",
        commitmentEndDate: "2027-02-31",
        paymentMethod: "card",
        paymentMethodDetail: "  Visa ···4321 ",
      }),
    ).toEqual({
      notes: "Contrato 12 meses",
      // El 31 de febrero se ajusta al último día del mes.
      commitmentEndDate: "2027-02-28",
      paymentMethod: "card",
      paymentMethodDetail: "Visa ···4321",
    });
    expect(
      sanitizeExpenseDetails({
        notes: "   ",
        commitmentEndDate: "pronto",
        paymentMethod: "crypto",
      }),
    ).toEqual({});
  });

  it("files a payment detail without a method under other", () => {
    expect(sanitizeExpenseDetails({ paymentMethodDetail: "Revolut" })).toEqual({
      paymentMethod: "other",
      paymentMethodDetail: "Revolut",
    });
  });

  it("caps long notes", () => {
    expect(sanitizeExpenseDetails({ notes: "x".repeat(1500) }).notes).toHaveLength(1000);
  });
});

describe("commitmentStatus", () => {
  it("warns in the last 30 days and says when it already ended", () => {
    expect(commitmentStatus(undefined, "2026-10-23")).toBeNull();
    expect(commitmentStatus("no", "2026-10-23")).toBeNull();
    expect(commitmentStatus("2027-03-01", "2026-10-23")).toMatchObject({ kind: "active" });
    expect(commitmentStatus("2026-11-22", "2026-10-23")).toEqual({
      kind: "ending",
      endDate: "2026-11-22",
      daysLeft: 30,
    });
    expect(commitmentStatus("2026-10-23", "2026-10-23")).toMatchObject({
      kind: "ending",
      daysLeft: 0,
    });
    expect(commitmentStatus("2026-10-22", "2026-10-23")).toMatchObject({
      kind: "ended",
      daysLeft: -1,
    });
  });
});
