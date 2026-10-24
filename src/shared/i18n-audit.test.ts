import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Capas de interfaz: el texto visible sale de i18n, no de ternarios por idioma.
// El dominio y el prompt de la IA quedan fuera (no son texto de la interfaz).
const uiRoots = ["src/app", "src/components", "src/features"].map((dir) =>
  join(process.cwd(), dir),
);
// Elegir la etiqueta de locale ("es-ES") con un ternario sí vale: no es texto.
const inlineCopyTernary =
  /language\s*===\s*"(?:es|en)"\s*\?\s*(?!["'`][a-z]{2}-[A-Z]{2}["'`])["'`]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return sourceFiles(fullPath);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [fullPath] : [];
  });
}

describe("i18n audit", () => {
  it("keeps UI copy out of inline language ternaries", () => {
    const violations = uiRoots.flatMap(sourceFiles).flatMap((file) =>
      inlineCopyTernary.test(readFileSync(file, "utf8"))
        ? [relative(process.cwd(), file)]
        : [],
    );

    expect(violations).toEqual([]);
  });
});
