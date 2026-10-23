import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { z } from "zod";
import type { CapturedExpenseItem } from "@/domain/expense-capture";
import type { AppLanguage } from "@/domain/types";

const FREQUENCIES = ["once", "monthly", "quarterly", "yearly", "custom"] as const;
const UNITS = ["day", "week", "month", "year"] as const;
const INTENTS = ["create", "pay", "skip", "move"] as const;
const FIELDS = [
  "intent",
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
            intent: { type: "string", enum: [...INTENTS] },
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
      { intent: "create", name: "Netflix", amount: 12.99, categoryName: "Suscripciones", frequency: null, interval: null, unit: null, dueDay: 5, annualMonth: null, startDate: null },
    ],
  },
  {
    text: "Seguro del coche 420 al año en marzo y gimnasio 35 al mes el día 1",
    expenses: [
      { intent: "create", name: "Seguro del coche", amount: 420, categoryName: "Vehiculo", frequency: "yearly", interval: null, unit: null, dueDay: null, annualMonth: 3, startDate: null },
      { intent: "create", name: "Gimnasio", amount: 35, categoryName: "Deporte", frequency: "monthly", interval: null, unit: null, dueDay: 1, annualMonth: null, startDate: null },
    ],
  },
  {
    text: "La luz, que viene cada dos meses",
    expenses: [
      { intent: "create", name: "Luz", amount: null, categoryName: "Casa", frequency: "custom", interval: 2, unit: "month", dueDay: null, annualMonth: null, startDate: null },
    ],
  },
  {
    text: "Rent 900 on the 1st and Spotify 10.99",
    expenses: [
      { intent: "create", name: "Rent", amount: 900, categoryName: "Casa", frequency: null, interval: null, unit: null, dueDay: 1, annualMonth: null, startDate: null },
      { intent: "create", name: "Spotify", amount: 10.99, categoryName: "Suscripciones", frequency: null, interval: null, unit: null, dueDay: null, annualMonth: null, startDate: null },
    ],
  },
  {
    text: "Marca la luz pagada 71,20 y salta el gimnasio este mes",
    expenses: [
      commandExample({ intent: "pay", name: "Luz", amount: 71.2 }),
      commandExample({ intent: "skip", name: "Gimnasio" }),
    ],
  },
  {
    text: "Mueve Netflix al 10 y he pagado el alquiler de noviembre",
    expenses: [
      commandExample({ intent: "move", name: "Netflix", dueDay: 10 }),
      commandExample({ intent: "pay", name: "Alquiler", annualMonth: 11 }),
    ],
  },
];

// Ejemplo de orden con los campos en el mismo orden que el esquema y null en
// lo que no aplica.
function commandExample(values: Partial<Record<(typeof FIELDS)[number], unknown>>) {
  return Object.fromEntries(FIELDS.map((field) => [field, values[field] ?? null]));
}

export function buildCaptureSystemInstruction({
  today,
  language,
  categories,
  expenseNames = [],
}: {
  today: string;
  language: AppLanguage;
  categories: string[];
  // Gastos que ya tiene el usuario, para las órdenes sobre ellos.
  expenseNames?: string[];
}) {
  const weekday = format(parseISO(today), "EEEE", { locale: es });
  const examples = EXAMPLES.map(
    (example) => `Texto: ${example.text}\nRespuesta: ${JSON.stringify({ expenses: example.expenses })}`,
  ).join("\n\n");

  return [
    "Extraes gastos recurrentes o puntuales de un texto para una app de control de recibos, y también órdenes sobre gastos que el usuario ya tiene.",
    `Hoy es ${today} (${weekday}), zona Europe/Madrid. Moneda: euros. Idioma de la app: ${language === "en" ? "inglés" : "español"}; el texto puede estar en español o en inglés.`,
    `Categorías permitidas (usa exactamente una de ellas o null): ${categories.join(", ")}.`,
    expenseNames.length
      ? `Gastos que ya tiene el usuario: ${expenseNames.join(", ")}.`
      : "El usuario aún no tiene gastos guardados.",
    "Reglas:",
    "- Un objeto por cada gasto u orden mencionado. Si no hay ninguno, devuelve expenses vacío.",
    "- intent: create para dar de alta un gasto (lo normal); pay para marcar como pagado uno que ya existe (\"marca la luz pagada 71,20\", \"he pagado el alquiler\"); skip para saltar su cobro de un mes (\"salta el gimnasio este mes\"); move para cambiar el día de un cobro (\"mueve Netflix al 10\").",
    "- En pay, skip y move: name es el gasto existente al que se refiere, con el nombre más parecido de la lista de gastos del usuario; amount solo en pay y solo si se dice lo pagado; dueDay (día) o startDate (fecha) solo en move, con el día o la fecha nueva; annualMonth es el mes del cobro si se nombra (\"la luz de octubre\", \"el mes que viene\"), si no null. El resto de campos, null.",
    "- name: corto, como lo diría el usuario, sin importe ni fechas.",
    "- amount: en euros. \"12,99\" y \"12.99\" son 12.99; \"2.200\" y \"2,200\" son 2200. Si no aparece, null. Nunca inventes importes.",
    "- frequency: mensual/al mes → monthly; trimestral/cada 3 meses → quarterly; anual/al año → yearly; puntual/una vez/solo este → once; cada N días, semanas o meses → custom con interval y unit. Si no se dice, null (la app lo marca para revisar).",
    "- dueDay: día del mes en que se cobra (\"el 5\", \"día 12\", \"on the 1st\"). Si no aparece, null.",
    "- annualMonth: mes (1-12) que se menciona para un gasto anual o puntual (\"en marzo\", \"el 12 de diciembre\"). Si no aparece, null.",
    "- startDate: fecha YYYY-MM-DD solo si el texto da una fecha concreta o relativa (\"mañana\", \"el viernes\", \"el mes que viene\"), calculada desde hoy. Si no, null.",
    "- Usa null para cualquier dato que no aparezca; no lo deduzcas.",
    "",
    "Ejemplos:",
    examples,
  ].join("\n");
}

// Validación tolerante de lo que devuelve la IA: un campo raro se queda en
// null en lugar de descartar todo el gasto. Sin intent (modelos o respuestas
// anteriores) es un alta.
const nullableNumber = z.number().finite().nullable().catch(null);
const aiExpenseItemSchema = z.object({
  intent: z.enum(INTENTS).catch("create"),
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
    // Una orden sin el gasto al que se refiere no sirve.
    const usable =
      parsed.success &&
      (parsed.data.intent === "create"
        ? Boolean(parsed.data.name?.trim()) || parsed.data.amount !== null
        : Boolean(parsed.data.name?.trim()));
    if (parsed.success && usable) items.push(parsed.data);
  }
  return { items, droppedCount: raw.length - items.length };
}
