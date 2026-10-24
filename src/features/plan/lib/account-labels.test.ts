import { describe, expect, it } from "vitest";
import {
  accountDisplayName,
  accountRoleChipClass,
  accountRoleLabel,
  accountRoleOptions,
  defaultAccountName,
} from "./account-labels";

describe("account labels", () => {
  it("names an unnamed account after its role, in each language", () => {
    expect(accountDisplayName({ name: "", role: "bills" }, "es")).toBe("Cuenta de recibos");
    expect(accountDisplayName({ name: "  ", role: "bills" }, "en")).toBe("Bills account");
    expect(defaultAccountName("savings", "es")).toBe("Cuenta de ahorro");
    expect(defaultAccountName("spending", "en")).toBe("Spending account");
  });

  it("keeps the name the user gave", () => {
    expect(accountDisplayName({ name: "Sabadell", role: "bills" }, "es")).toBe("Sabadell");
  });

  it("labels the three roles", () => {
    expect(["bills", "savings", "spending"].map((role) =>
      accountRoleLabel(role as "bills" | "savings" | "spending", "es"),
    )).toEqual(["Recibos", "Ahorro", "Libre"]);
    expect(accountRoleOptions("en").map((option) => [option.value, option.label])).toEqual([
      ["bills", "Bills"],
      ["savings", "Savings"],
      ["spending", "Spending"],
    ]);
    expect(accountRoleOptions("es").every((option) => option.description.length > 0)).toBe(true);
    expect(accountRoleChipClass("savings")).toBe("app-chip-green");
  });
});
