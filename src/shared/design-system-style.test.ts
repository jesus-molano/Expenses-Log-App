import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const checkedExtensions = new Set([".ts", ".tsx"]);
const forbiddenPatterns: Array<[RegExp, string]> = [
  [
    /\b(?:bg|text|border|ring)-(?:slate|white|lime|cyan|orange|rose|violet|yellow)(?:-|\/|\b)/,
    "fixed Tailwind color utility",
  ],
  [/shadow-\[/, "arbitrary shadow utility"],
  [/backdrop-blur(?:-|$)/, "backdrop blur utility"],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) return sourceFiles(fullPath);

    const extension = fullPath.slice(fullPath.lastIndexOf("."));
    return checkedExtensions.has(extension) ? [fullPath] : [];
  });
}

describe("design system style audit", () => {
  it("keeps visual primitives behind semantic tokens", () => {
    const violations = sourceFiles(sourceRoot).flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return forbiddenPatterns.flatMap(([pattern, description]) => {
        if (!pattern.test(content)) return [];

        return [`${relative(process.cwd(), file)} uses ${description}`];
      });
    });

    expect(violations).toEqual([]);
  });
});
