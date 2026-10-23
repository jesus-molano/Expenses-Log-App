import { describe, expect, it } from "vitest";
import { commitmentStatus } from "@/domain/expense-details";
import {
  categoryUsageLabel,
  commitmentLabel,
  paymentMethodLabel,
} from "./expense-detail-labels";

describe("expense detail labels", () => {
  it("describes the payment method with its detail", () => {
    expect(paymentMethodLabel(undefined, "Visa", "es")).toBe("");
    expect(paymentMethodLabel("card", "Visa ···4321", "es")).toBe("Tarjeta · Visa ···4321");
    expect(paymentMethodLabel("direct_debit", undefined, "en")).toBe("Direct debit");
    expect(paymentMethodLabel("other", "Revolut", "es")).toBe("Revolut");
  });

  it("explains how long is left of a commitment", () => {
    const today = "2026-10-23";
    expect(commitmentLabel(commitmentStatus("2026-11-12", today)!, "es")).toBe(
      "La permanencia acaba en 20 días (12 nov 2026)",
    );
    expect(commitmentLabel(commitmentStatus("2026-10-24", today)!, "es")).toBe(
      "La permanencia acaba mañana (24 oct 2026)",
    );
    expect(commitmentLabel(commitmentStatus("2026-10-23", today)!, "en")).toBe(
      "Commitment ends today",
    );
    expect(commitmentLabel(commitmentStatus("2026-09-30", today)!, "es")).toBe(
      "Sin permanencia desde el 30 sep 2026",
    );
    expect(commitmentLabel(commitmentStatus("2027-06-30", today)!, "en")).toBe(
      "Commitment until 30 Jun 2027",
    );
  });

  it("counts category usage", () => {
    expect(categoryUsageLabel(0, "es")).toBe("Sin gastos");
    expect(categoryUsageLabel(1, "es")).toBe("1 gasto");
    expect(categoryUsageLabel(4, "en")).toBe("4 expenses");
  });
});
