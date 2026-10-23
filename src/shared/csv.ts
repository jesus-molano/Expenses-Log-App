// CSV (RFC 4180) para exportar e importar. Al leer acepta coma o punto y coma
// (Excel en español guarda con ";"), BOM, saltos CRLF y campos entre comillas
// con comillas dobladas o saltos de línea.
export type CsvDelimiter = "," | ";";

// Marca de orden de bytes: sin ella, Excel abre el UTF-8 como Latin-1 y
// rompe las tildes.
export const CSV_BOM = "﻿";

export function serializeCsv(rows: string[][], delimiter: CsvDelimiter = ","): string {
  return rows
    .map((row) => row.map((field) => escapeField(field, delimiter)).join(delimiter))
    .join("\r\n");
}

function escapeField(value: string, delimiter: CsvDelimiter) {
  return value.includes(delimiter) || /["\r\n]/.test(value) || value !== value.trim()
    ? `"${value.replaceAll('"', '""')}"`
    : value;
}

export function parseCsv(text: string): string[][] {
  const source = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const delimiter = detectCsvDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Las líneas en blanco (también la del final) no son filas.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

// El separador que más aparece en la cabecera, fuera de comillas.
export function detectCsvDelimiter(text: string): CsvDelimiter {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char === ",") commas += 1;
    else if (!quoted && char === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

// Una hoja de cálculo ejecuta como fórmula el texto que empieza por = + - @:
// se antepone un apóstrofo, que las hojas ocultan, y se quita al importar.
const FORMULA_START = /^[=+\-@\t\r]/;

export function protectSpreadsheetText(value: string) {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export function unprotectSpreadsheetText(value: string) {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1))
    ? value.slice(1)
    : value;
}
