import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Evalúa los tokens de `tokens.css` como lo haría el navegador (hex, var() y
// color-mix en srgb) para comprobar el contraste de cada tema.
type Rgba = [number, number, number, number];

const css = readFileSync(join(process.cwd(), "src/app/styles/tokens.css"), "utf8");

function declarations(body: string) {
  return Object.fromEntries(
    Array.from(body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g), (match) => [
      match[1],
      match[2].trim(),
    ]),
  );
}

function themeVariables() {
  const blocks = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({
    selector: match[1].trim(),
    vars: declarations(match[2]),
  }));
  const base = blocks
    .filter(({ selector }) =>
      selector.split(",").some((part) => part.trim() === ":root"),
    )
    .reduce<Record<string, string>>((all, block) => ({ ...all, ...block.vars }), {});
  const themes = new Map<string, Record<string, string>>();
  for (const { selector, vars } of blocks) {
    for (const match of selector.matchAll(/data-theme="([\w-]+)"/g)) {
      themes.set(match[1], { ...base, ...vars });
    }
  }
  return themes;
}

function splitTopLevel(value: string) {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

function evaluate(expression: string, vars: Record<string, string>): Rgba {
  const value = expression.trim();
  if (value === "transparent") return [0, 0, 0, 0];
  if (value === "white") return [255, 255, 255, 1];
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    return [0, 2, 4].map((index) =>
      parseInt(hex[1].slice(index, index + 2), 16),
    ).concat(1) as Rgba;
  }
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  if (reference) {
    const resolved = vars[reference[1]];
    if (!resolved) throw new Error(`Unknown token ${reference[1]}`);
    return evaluate(resolved, vars);
  }
  const mix = /^color-mix\((.*)\)$/.exec(value);
  if (mix) {
    const [space, first, second] = splitTopLevel(mix[1]);
    if (space !== "in srgb") throw new Error(`Unsupported color space ${space}`);
    const [colorA, weightA] = colorStop(first);
    const [colorB, weightB] = colorStop(second);
    const a = evaluate(colorA, vars);
    const b = evaluate(colorB, vars);
    const p = weightA ?? (weightB === undefined ? 0.5 : 1 - weightB);
    // Interpolación premultiplicada, como color-mix.
    const alpha = a[3] * p + b[3] * (1 - p);
    const channel = (index: number) =>
      alpha === 0 ? 0 : (a[index] * a[3] * p + b[index] * b[3] * (1 - p)) / alpha;
    return [channel(0), channel(1), channel(2), alpha];
  }
  throw new Error(`Unsupported color ${value}`);
}

function colorStop(value: string): [string, number | undefined] {
  const match = /^(.*?)\s+(\d+(?:\.\d+)?)%$/.exec(value);
  return match ? [match[1], Number(match[2]) / 100] : [value, undefined];
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const alpha = top[3];
  return [0, 1, 2].map((index) => top[index] * alpha + bottom[index] * (1 - alpha))
    .concat(1) as Rgba;
}

function luminance([r, g, b]: Rgba) {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgba, b: Rgba) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const themes = themeVariables();

describe("theme contrast", () => {
  it("finds every theme in the tokens", () => {
    expect(Array.from(themes.keys()).sort()).toEqual([
      "atlas",
      "catppuccin",
      "dracula",
      "nord",
      "obsidian-amber",
      "rose-pine",
      "tokyo-night",
      "vice-afterglow",
    ]);
  });

  it.each(Array.from(themes.entries()))(
    "keeps subtle text at WCAG AA on the backgrounds it sits on (%s)",
    (_theme, vars) => {
      const token = (name: string) => evaluate(`var(${name})`, vars);
      const surface = token("--app-surface");
      const strong = token("--app-surface-strong");
      const backgrounds: Record<string, Rgba> = {
        bg: token("--app-bg"),
        bgSoft: token("--app-bg-soft"),
        surface,
        strong,
        raised: token("--app-surface-raised"),
        controlOnSurface: over(token("--app-control"), surface),
        controlOnSheet: over(token("--app-control"), strong),
        hoverOnSurface: over(token("--app-control-hover"), surface),
        hoverOnSheet: over(token("--app-control-hover"), strong),
      };
      const subtle = token("--app-text-subtle");

      for (const [name, background] of Object.entries(backgrounds)) {
        expect
          .soft(contrast(subtle, background), `${name}`)
          .toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
