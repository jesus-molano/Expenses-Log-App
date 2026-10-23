import { describe, expect, it } from "vitest";
import {
  formatMoneyInput,
  isValidMoneyInput,
  isValidPositiveMoneyInput,
  parseMoneyInput,
} from "./money";

describe("parseMoneyInput", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["64,75", 64.75],
    ["64.75", 64.75],
    ["2.200", 2200],
    ["2,200", 2200],
    ["10.000", 10000],
    ["1.234.567", 1234567],
    ["12345", 12345],
    ["12 €", 12],
    ["0,5", 0.5],
    ["9,999", 9999],
    ["1.5", 1.5],
    ["  42  ", 42],
    ["12,345", 12345],
    ["10,005", 10005],
    ["0,999", 1],
    ["0", 0],
    ["12,", 12],
    ["12.", 12],
    ["1.234,", 1234],
    [",5", 0.5],
    [".5", 0.5],
  ])("reads %s as %d", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "1,2,3", "12..5", "1.23.4", "1.234,5,6", "€", ",", ".", "12,,"])(
    "rejects %j",
    (input) => {
      expect(parseMoneyInput(input)).toBeNull();
    },
  );

  it("rounds to cents", () => {
    expect(parseMoneyInput("10.1234")).toBe(10.12);
    expect(parseMoneyInput("10,4567")).toBe(10.46);
  });
});

describe("formatMoneyInput", () => {
  it("never groups thousands so the value reads back unchanged", () => {
    for (const language of ["es", "en"] as const) {
      for (const value of [2200, 12345.5, 64.75, 0.5, 1234567.89]) {
        expect(parseMoneyInput(formatMoneyInput(value, language))).toBe(value);
      }
    }
    expect(formatMoneyInput(2200, "en")).toBe("2200");
    expect(formatMoneyInput(12345.5, "es")).toBe("12345,5");
  });
});

describe("isValidPositiveMoneyInput", () => {
  it("requires an amount above zero", () => {
    expect(isValidPositiveMoneyInput("12,99")).toBe(true);
    expect(isValidPositiveMoneyInput("0")).toBe(false);
    expect(isValidPositiveMoneyInput("abc")).toBe(false);
  });
});

describe("isValidMoneyInput", () => {
  it("accepts zero only where it is a real value", () => {
    expect(isValidMoneyInput("0", { allowZero: true })).toBe(true);
    expect(isValidMoneyInput("0")).toBe(false);
    expect(isValidMoneyInput("", { allowZero: true })).toBe(false);
    expect(isValidMoneyInput("abc", { allowZero: true })).toBe(false);
  });
});
