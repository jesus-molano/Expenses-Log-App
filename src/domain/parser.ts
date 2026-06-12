import { z } from "zod";
import { buildDateWithDay, toDateOnly } from "./calendar";
import type { DraftExpense, RecurrenceRule } from "./types";

export const draftExpenseSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(240).default(""),
  amount: z.number().positive(),
  categoryName: z.string().min(1).max(40),
  startDate: z.string().optional(),
  dueDay: z.number().int().min(1).max(31),
  recurrence: z.object({
    frequency: z.enum(["once", "monthly", "quarterly", "yearly", "custom", "rrule"]),
    interval: z.number().int().positive().optional(),
    unit: z.enum(["day", "week", "month", "year"]).optional(),
    rrule: z.string().optional(),
    annualMonth: z.number().int().min(1).max(12).optional(),
  }),
});

export const parseExpensesResponseSchema = z.object({
  expenses: z.array(draftExpenseSchema).min(1).max(10),
});

const categoryHints: Array<[string, string[]]> = [
  ["Casa", ["alquiler", "hipoteca", "comunidad", "luz", "agua"]],
  ["Alimentacion", ["compra", "supermercado", "mercadona", "comida", "alimentacion"]],
  ["Suscripciones", ["netflix", "spotify", "icloud", "prime", "hbo", "youtube"]],
  ["Vehiculo", ["gasolina", "parking", "seguro coche", "rodaje", "coche"]],
  ["Transporte", ["bono", "bus", "metro", "tranvia", "taxi"]],
  ["Deporte", ["gym", "gimnasio", "crossfit", "deporte"]],
  ["Salud", ["seguro medico", "farmacia", "dentista", "medico"]],
  ["Servicios", ["internet", "movil", "telefono", "fibra"]],
  ["Mascotas", ["gato", "perro", "veterinario", "mascota"]],
  ["Educacion/Trabajo", ["codex", "curso", "software", "trabajo", "formacion"]],
];

function detectRecurrence(text: string): RecurrenceRule {
  if (/puntual|unico|único|una\s+vez|one[-\s]?time/i.test(text)) {
    return { frequency: "once" };
  }
  if (/trimestral|cada\s+3\s+mes/i.test(text)) {
    return { frequency: "quarterly" };
  }
  if (/anual|ano|yearly/i.test(text)) {
    return { frequency: "yearly" };
  }
  const customMatch = text.match(
    /cada\s+(\d+)\s+(dia|dias|semana|semanas|mes|meses)/i,
  );
  if (customMatch) {
    const unitToken = customMatch[2].toLowerCase();
    const unit = unitToken.startsWith("sem")
      ? "week"
      : unitToken.startsWith("d")
        ? "day"
        : "month";
    return {
      frequency: "custom",
      interval: Number(customMatch[1]),
      unit,
    };
  }
  return { frequency: "monthly" };
}

function detectCategory(text: string): string {
  const normalized = text.toLowerCase();
  const match = categoryHints.find(([, hints]) =>
    hints.some((hint) => normalized.includes(hint)),
  );

  return match?.[0] ?? "General";
}

export function parseExpenseTextLocally(input: string): DraftExpense[] {
  const normalized = input.trim();
  if (!normalized) return [];

  const amountMatch = normalized.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:eur|euros)?/i);
  const dayMatch = normalized.match(/(?:dia|el)\s*(\d{1,2})/i);
  const categoryName = detectCategory(normalized);

  const amount = amountMatch
    ? Number(amountMatch[1].replace(",", "."))
    : 0;
  const dueDay = dayMatch
    ? Math.min(Number(dayMatch[1]), 31)
    : new Date().getDate();
  const startDate = toDateOnly(buildDateWithDay(new Date(), dueDay));
  const name = normalized
    .replace(amountMatch?.[0] ?? "", "")
    .replace(/puntual|unico|único|una\s+vez|mensual|trimestral|anual|cada\s+\d+\s+\w+/gi, "")
    .replace(/(?:dia|el)\s*\d{1,2}/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");

  return [
    {
      name: name || "Nuevo gasto",
      description: normalized,
      amount: amount || 1,
      categoryName,
      startDate,
      dueDay,
      recurrence: detectRecurrence(normalized),
    },
  ];
}
