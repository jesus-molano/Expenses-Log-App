import { describe, expect, it } from "vitest";
import {
  CSV_BOM,
  detectCsvDelimiter,
  parseCsv,
  protectSpreadsheetText,
  serializeCsv,
  unprotectSpreadsheetText,
} from "./csv";

describe("csv", () => {
  it("round-trips quotes, delimiters, line breaks and padding", () => {
    const rows = [
      ["name", "description"],
      ['Seguro "todo riesgo"', "Coche, moto"],
      ["Luz", "Línea 1\nLínea 2"],
      [" espacio ", ""],
    ];

    expect(parseCsv(serializeCsv(rows))).toEqual(rows);
    expect(parseCsv(serializeCsv(rows, ";"))).toEqual(rows);
  });

  it("reads the semicolon files that Excel saves in Spanish", () => {
    const text = `${CSV_BOM}name;amount\r\nLuz;64,75\r\n\r\nAgua;"20,00"\r\n`;

    expect(detectCsvDelimiter(text)).toBe(";");
    expect(parseCsv(text)).toEqual([
      ["name", "amount"],
      ["Luz", "64,75"],
      ["Agua", "20,00"],
    ]);
  });

  it("detects the delimiter from the header only, ignoring quoted text", () => {
    expect(detectCsvDelimiter('"a;b;c",d\n1;2;3;4')).toBe(",");
    expect(detectCsvDelimiter("a,b\n")).toBe(",");
  });

  it("neutralises spreadsheet formulas and restores them on import", () => {
    expect(protectSpreadsheetText("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(protectSpreadsheetText("+34 600")).toBe("'+34 600");
    expect(protectSpreadsheetText("Netflix")).toBe("Netflix");
    expect(unprotectSpreadsheetText("'=HYPERLINK(1)")).toBe("=HYPERLINK(1)");
    expect(unprotectSpreadsheetText("'Netflix")).toBe("'Netflix");
  });
});
