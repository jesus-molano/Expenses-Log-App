import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { z } from "zod";
import type { CapturedExpenseItem } from "@/domain/expense-capture";
import type { AppLanguage } from "@/domain/types";

const FREQUENCIES = ["once", "monthly", "quarterly", "yearly", "custom"] as const;
const UNITS = ["day", "week", "month", "year"] as const;
const FIELDS = [
  "name",
  "amount",
  "categoryName",
  "frequency",
  "interval",
  "unit",
  "dueDay",
  "annualMonth",
  "startDate",
] as const;

function nullable(schema: Record<string, unknown>) {
  return { anyOf: [schema, { type: "null" }] };
}

// Esquema para `responseJsonSchema`, escrito a mano: solo usa palabras clave
// que Gemini acepta (sin minLength, pattern ni exclusiveMinimum).
export function buildCaptureResponseSchema(categories: string[]) {
  return {
    type: "object",
    properties: {
      expenses: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            amount: nullable({ type: "number", minimum: 0 }),
            categoryName: nullable({ type: "string", enum: categories }),
            frequency: nullable({ type: "string", enum: [...FREQUENCIES] }),
            interval: nullable({ type: "integer", minimum: 1 }),
            unit: nullable({ type: "string", enum: [...UNITS] }),
            dueDay: nullable({ type: "integer", minimum: 1, maximum: 31 }),
            annualMonth: nullable({ type: "integer", minimum: 1, maximum: 12 }),
            startDate: nullable({ type: "string", format: "date" }),
          },
          required: [...FIELDS],
          propertyOrdering: [...FIELDS],
        },
      },
    },
    required: ["expenses"],
  };
}

const EXAMPLES = [
  {
    text: "Netflix 12,99 el 5",
    expenses: [
      { name: "Netflix", amount: 12.99, categoryName: "Suscripciones", frequency: "monthly", interval: null, unit: null, dueDay: 5, annualMonth: null, startDate: null },
    ],
  },
  {
    text: "Seguro del coche 420 al año en marzo y gimnasio 35 al mes el día 1",
    expenses: [
      { name: "Seguro del coche", amount: 420, categoryName: "Vehiculo", frequency: "yearly", interval: null, unit: null, dueDay: null, annualMonth: 3, startDate: null },
      { name: "Gimnasio", amount: 35, categoryName: "Deporte", frequency: "monthly", interval: null, unit: null, dueDay: 1, annualMonth: null, startDate: null },
    ],
  },
  {
    text: "La luz, que viene cada dos meses",
    expenses: [
      { name: "Luz", amount: null, categoryName: "Casa", frequency: "custom", interval: 2, unit: "month", dueDay: null, annualMonth: null, startDate: null },
    ],
  },
  {
    text: "Rent 900 on the 1st and Spotify 10.99",
    expenses: [
      { name: "Rent", amount: 900, categoryName: "Casa", frequency: "monthly", interval: null, unit: null, dueDay: 1, annualMonth: null, startDate: null },
      { name: "Spotify", amount: 10.99, categoryName: "Suscripciones", frequency: "monthly", interval: null, unit: null, dueDay: null, annualMonth: null, startDate: null },
    ],
  },
];

export function buildCaptureSystemInstruction({
  today,
  language,
  categories,
}: {
  today: string;
  language: AppLanguage;
  categories: string[];
}) {
  const weekday = format(parseISO(today), "EEEE", { locale: es });
  const examples = EXAMPLES.map(
    (example) => `Texto: ${example.text}\nRespuesta: ${JSON.stringify({ expenses: example.expenses })}`,
  ).join("\n\n");

  return [
    "Extraes gastos recurrentes o puntuales de un texto para una app de control de recibos.",
    `Hoy es ${today} (${weekday}), zona Europe/Madrid. Moneda: euros. Idioma de la app: ${language === "en" ? "inglés" : "español"}; el texto puede estar en español o en inglés.`,
    `Categorías permitidas (usa exactamente una de ellas o null): ${categories.join(", ")}.`,
    "Reglas:",
    "- Un objeto por cada gasto mencionado. Si no hay ningún gasto, devuelve expenses vacío.",
    "- name: corto, como lo diría el usuario, sin importe ni fechas.",
    "- amount: en euros. \"12,99\" y \"12.99\" son 12.99; \"2.200\" y \"2,200\" son 2200. Si no aparece, null. Nunca inventes importes.",
    "- frequency: mensual/al mes → monthly; trimestral/cada 3 meses → quarterly; anual/al año → yearly; puntual/una vez/solo este → once; cada N días, semanas o meses → custom con interval y unit. Si no se dice, monthly.",
    "- dueDay: día del mes en que se cobra (\"el 5\", \"día 12\", \"on the 1st\"). Si no aparece, null.",
    "- annualMonth: mes (1-12) de un gasto anual (\"en marzo\"). Si no aparece, null.",
    "- startDate: fecha YYYY-MM-DD solo si el texto da una fecha concreta o relativa (\"mañana\", \"el viernes\", \"el mes que viene\"), calculada desde hoy. Si no, null.",
    "- Usa null para cualquier dato que no aparezca; no lo deduzcas.",
    "",
    "Ejemplos:",
    examples,
  ].join("\n");
}

// Validación tolerante de lo que devuelve la IA: un campo raro se queda en
// null en lugar de descartar todo el gasto.
const nullableNumber = z.number().finite().nullable().catch(null);
const aiExpenseItemSchema = z.object({
  name: z.string().nullable().catch(null),
  amount: nullableNumber,
  categoryName: z.string().nullable().catch(null),
  frequency: z.enum(FREQUENCIES).nullable().catch(null),
  interval: nullableNumber,
  unit: z.enum(UNITS).nullable().catch(null),
  dueDay: nullableNumber,
  annualMonth: nullableNumber,
  startDate: z.string().nullable().catch(null),
});

export function parseCaptureResponse(json: unknown): {
  items: CapturedExpenseItem[];
  droppedCount: number;
} | null {
  if (!json || typeof json !== "object" || !Array.isArray((json as { expenses?: unknown }).expenses)) {
    return null;
  }
  const raw = (json as { expenses: unknown[] }).expenses.slice(0, 10);
  const items: CapturedExpenseItem[] = [];
  for (const candidate of raw) {
    const parsed = aiExpenseItemSchema.safeParse(candidate);
    if (parsed.success && (parsed.data.name?.trim() || parsed.data.amount !== null)) {
      items.push(parsed.data);
    }
  }
  return { items, droppedCount: raw.length - items.length };
}
