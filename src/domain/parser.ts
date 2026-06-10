import { z } from "zod";
import type { DraftExpense, RecurrenceRule } from "./types";

export const draftExpenseSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(240).default(""),
  amount: z.number().positive(),
  categoryName: z.string().min(1).max(40),
  tags: z.array(z.string().min(1).max(24)).max(8).default([]),
  dueDay: z.number().int().min(1).max(31),
  recurrence: z.object({
    frequency: z.enum(["monthly", "quarterly", "yearly", "custom", "rrule"]),
    interval: z.number().int().positive().optional(),
    unit: z.enum(["day", "week", "month", "year"]).optional(),
    rrule: z.string().optional(),
  }),
});

export const parseExpensesResponseSchema = z.object({
  expenses: z.array(draftExpenseSchema).min(1).max(10),
});

const categoryHints: Array<[string, string, string[]]> = [
  ["Vivienda", "Casa", ["alquiler", "hipoteca", "comunidad", "luz", "agua"]],
  ["Suscripciones", "Sub", ["netflix", "spotify", "icloud", "prime", "hbo"]],
  ["Transporte", "Coche", ["gasolina", "parking", "seguro", "bono", "bus"]],
  ["Salud", "Salud", ["seguro medico", "farmacia", "dentista", "gimnasio"]],
  ["Servicios", "Servicio", ["internet", "movil", "telefono", "fibra"]],
];

function detectRecurrence(text: string): RecurrenceRule {
  if (/trimestral|cada\s+3\s+mes/i.test(text)) {
    return { frequency: "quarterly" };
  }
  if (/anual|ano|año|yearly/i.test(text)) {
    return { frequency: "yearly" };
  }
  const customMatch = text.match(/cada\s+(\d+)\s+(dia|dias|día|días|semana|semanas|mes|meses)/i);
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

function detectCategory(text: string): { categoryName: string; tags: string[] } {
  const normalized = text.toLowerCase();
  const match = categoryHints.find(([, , hints]) =>
    hints.some((hint) => normalized.includes(hint)),
  );

  if (!match) {
    return { categoryName: "General", tags: ["general"] };
  }

  return {
    categoryName: match[0],
    tags: [match[1].toLowerCase()],
  };
}

export function parseExpenseTextLocally(input: string): DraftExpense[] {
  const normalized = input.trim();
  if (!normalized) return [];

  const amountMatch = normalized.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)?/i);
  const dayMatch = normalized.match(/(?:dia|día|el)\s*(\d{1,2})/i);
  const { categoryName, tags } = detectCategory(normalized);

  const amount = amountMatch
    ? Number(amountMatch[1].replace(",", "."))
    : 0;
  const dueDay = dayMatch
    ? Math.min(Number(dayMatch[1]), 31)
    : new Date().getDate();
  const name = normalized
    .replace(amountMatch?.[0] ?? "", "")
    .replace(/mensual|trimestral|anual|cada\s+\d+\s+\w+/gi, "")
    .replace(/(?:dia|día|el)\s*\d{1,2}/gi, "")
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
      tags,
      dueDay,
      recurrence: detectRecurrence(normalized),
    },
  ];
}
