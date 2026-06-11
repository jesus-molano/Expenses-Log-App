import { describe, expect, it } from "vitest";
import { formatEuroInput, parseEuroInput } from "./euro-input";

describe("euro input helpers", () => {
  it("parses spanish and english decimal formats", () => {
    expect(parseEuroInput("1.234,56")).toBe(1234.56);
    expect(parseEuroInput("1,234.56")).toBe(1234.56);
    expect(parseEuroInput("64,75")).toBe(64.75);
    expect(parseEuroInput("64.75")).toBe(64.75);
  });

  it("returns zero for invalid input", () => {
    expect(parseEuroInput("")).toBe(0);
    expect(parseEuroInput("abc")).toBe(0);
  });

  it("formats with the selected locale", () => {
    expect(formatEuroInput(1234.5, "es")).toBe("1234,5");
    expect(formatEuroInput(1234.5, "en")).toBe("1,234.5");
  });
});
