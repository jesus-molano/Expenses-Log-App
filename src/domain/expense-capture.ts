import { buildDateWithDay, normalizeDateOnly, toDateOnly } from "./calendar";
import { PRESET_EXPENSE_CATEGORIES } from "./categories";
import type {
  CustomRecurrenceUnit,
  DraftExpense,
  RecurrenceFrequency,
  RecurrenceRule,
} from "./types";

// Lo que se acepta analizar de una vez (el campo de texto lo limita igual).
export const CAPTURE_TEXT_MAX_LENGTH = 2000;

// Lo que se extrae de un texto (Gemini o el parser local) antes de convertirlo
// en borrador. Un dato que no aparece es null: nunca se inventa.
export type CapturedExpenseItem = {
  name: string | null;
  amount: number | null;
  categoryName: string | null;
  frequency: Exclude<RecurrenceFrequency, "rrule"> | null;
  interval: number | null;
  unit: CustomRecurrenceUnit | null;
  dueDay: number | null;
  annualMonth: number | null;
  startDate: string | null;
  description?: string | null;
  // El parser local eligió el importe entre varios números: hay que revisarlo.
  amountGuessed?: boolean;
};

export type CaptureField = "amount" | "dueDay" | "startDate" | "categoryName" | "frequency";

export type CapturedDraft = {
  draft: DraftExpense;
  // Lo que el usuario tiene que completar antes de guardar.
  missingFields: CaptureField[];
  // Lo que se ha deducido y conviene revisar.
  inferredFields: CaptureField[];
};

const CATEGORY_ALIASES: Array<[string, string[]]> = [
  ["Casa", ["casa", "hogar", "home", "house", "housing", "rent", "alquiler", "hipoteca", "mortgage"]],
  ["Alimentacion", ["alimentacion", "comida", "food", "groceries", "supermercado", "supermarket"]],
  ["Servicios", ["servicios", "suministros", "utilities", "services", "internet", "telefono", "phone"]],
  ["Suscripciones", ["suscripcion", "suscripciones", "subscription", "subscriptions", "streaming"]],
  ["Vehiculo", ["vehiculo", "coche", "car", "vehicle", "moto"]],
  ["Transporte", ["transporte", "transport", "transit"]],
  ["Salud", ["salud", "health", "medico", "medical"]],
  ["Deporte", ["deporte", "sport", "sports", "gym", "gimnasio", "fitness"]],
  ["Deudas", ["deudas", "deuda", "debt", "loan", "prestamo", "credito"]],
  ["Ahorro", ["ahorro", "savings", "saving"]],
  ["Ocio", ["ocio", "leisure", "entertainment", "entretenimiento"]],
  ["Educacion/Trabajo", ["educacion", "trabajo", "education", "work", "formacion"]],
  ["Mascotas", ["mascotas", "mascota", "pets", "pet"]],
  ["Personal", ["personal"]],
  ["General", ["general", "otros", "other", "misc"]],
];

// Pistas por nombre del gasto, para cuando no llega categoría.
const CATEGORY_HINTS: Array<[string, string[]]> = [
  ["Casa", ["alquiler", "hipoteca", "comunidad", "luz", "agua", "gas", "rent"]],
  ["Alimentacion", ["compra", "supermercado", "mercadona", "lidl", "carrefour", "comida"]],
  ["Suscripciones", ["netflix", "spotify", "icloud", "prime", "hbo", "max", "disney", "youtube", "chatgpt"]],
  ["Vehiculo", ["gasolina", "parking", "seguro coche", "seguro del coche", "itv", "taller", "coche"]],
  ["Transporte", ["bono", "abono", "bus", "metro", "tranvia", "taxi", "renfe"]],
  ["Deporte", ["gym", "gimnasio", "crossfit", "padel", "piscina"]],
  ["Salud", ["seguro medico", "farmacia", "dentista", "medico", "sanitas", "adeslas"]],
  ["Servicios", ["internet", "movil", "telefono", "fibra", "vodafone", "movistar", "orange"]],
  ["Mascotas", ["gato", "perro", "veterinario", "mascota", "pienso"]],
  ["Educacion/Trabajo", ["curso", "software", "formacion", "academia", "universidad"]],
  ["Deudas", ["prestamo", "tarjeta", "financiacion", "cuota"]],
];

// Sin tildes ni mayúsculas, para comparar lo que dice el usuario o la IA.
export function foldText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function hasWord(text: string, phrase: string) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${phrase}($|[^\\p{L}\\p{N}])`, "u").test(text);
}

export function detectCategoryFromText(text: string) {
  const folded = foldText(text);
  return (
    CATEGORY_HINTS.find(([, hints]) => hints.some((hint) => hasWord(folded, hint)))?.[0] ??
    null
  );
}

// Una categoría del usuario o preset con el mismo nombre (sin tildes), un
// alias en español o inglés, o null.
export function matchCategoryName(name: string | null, categories: string[]) {
  if (!name) return null;
  const folded = foldText(name);
  const known = [...categories, ...PRESET_EXPENSE_CATEGORIES.map((category) => category.name)];
  const exact = known.find((category) => foldText(category) === folded);
  if (exact) return exact;
  return CATEGORY_ALIASES.find(([, aliases]) => aliases.includes(folded))?.[0] ?? null;
}

function recurrenceFor(item: CapturedExpenseItem): {
  recurrence: RecurrenceRule;
  inferred: boolean;
} {
  const frequency = item.frequency;
  if (!frequency) return { recurrence: { frequency: "monthly" }, inferred: true };
  if (frequency !== "custom") return { recurrence: { frequency }, inferred: false };

  const interval = Math.max(Math.round(item.interval ?? 1), 1);
  const unit = item.unit ?? "month";
  // "Cada 3 meses" y compañía tienen su frecuencia propia.
  if (unit === "month" && interval === 1) return { recurrence: { frequency: "monthly" }, inferred: false };
  if (unit === "month" && interval === 3) return { recurrence: { frequency: "quarterly" }, inferred: false };
  if ((unit === "month" && interval === 12) || (unit === "year" && interval === 1)) {
    return { recurrence: { frequency: "yearly" }, inferred: false };
  }
  return { recurrence: { frequency: "custom", interval, unit }, inferred: false };
}

function validDay(value: number | null) {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= 31 ? value : null;
}

function validMonth(value: number | null) {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}

function nextDateInMonth(today: string, month: number, day: number) {
  const year = Number(today.slice(0, 4));
  const thisYear = toDateOnly(buildDateWithDay(new Date(year, month - 1, 1), day));
  return thisYear >= today
    ? thisYear
    : toDateOnly(buildDateWithDay(new Date(year + 1, month - 1, 1), day));
}

// Convierte lo extraído en un borrador que el formulario puede abrir. Las
// fechas y el día de cobro se reconcilian con la misma regla que al guardar:
// un gasto puntual (o cada N días/semanas) vive en su startDate; el resto, en
// su dueDay.
export function normalizeCapturedExpense(
  item: CapturedExpenseItem,
  { today, categories = [] }: { today: string; categories?: string[] },
): CapturedDraft {
  const missingFields: CaptureField[] = [];
  const inferredFields: CaptureField[] = [];
  const todayDate = new Date(`${today}T00:00:00`);

  const name = (item.name ?? "").trim().slice(0, 80) || "Nuevo gasto";
  const amount =
    item.amount !== null && Number.isFinite(item.amount) && item.amount > 0
      ? Math.round(item.amount * 100) / 100
      : 0;
  if (!amount) missingFields.push("amount");
  if (amount && item.amountGuessed) inferredFields.push("amount");

  const { recurrence, inferred: frequencyInferred } = recurrenceFor(item);
  if (frequencyInferred) inferredFields.push("frequency");

  const explicitStart = normalizeDateOnly(item.startDate);
  const explicitDay = validDay(item.dueDay);
  const anchoredToStart =
    recurrence.frequency === "once" ||
    (recurrence.frequency === "custom" && ["day", "week"].includes(recurrence.unit ?? ""));

  let startDate: string;
  let dueDay: number;
  const mentionedMonth = validMonth(item.annualMonth);
  if (anchoredToStart) {
    if (explicitStart) {
      startDate = explicitStart;
    } else if (mentionedMonth) {
      // "El 12 de diciembre": la próxima vez que llega esa fecha.
      startDate = nextDateInMonth(today, mentionedMonth, explicitDay ?? 1);
      if (!explicitDay) inferredFields.push("startDate");
    } else {
      startDate = explicitDay ? toDateOnly(buildDateWithDay(todayDate, explicitDay)) : today;
      if (!explicitDay) inferredFields.push("startDate");
    }
    dueDay = Number(startDate.slice(8, 10));
  } else {
    startDate = explicitStart ?? `${today.slice(0, 7)}-01`;
    dueDay = explicitDay ?? (explicitStart ? Number(explicitStart.slice(8, 10)) : todayDate.getDate());
    if (!explicitDay && !explicitStart) inferredFields.push("dueDay");
  }

  if (recurrence.frequency === "yearly") {
    const annualMonth =
      validMonth(item.annualMonth) ??
      (explicitStart ? Number(explicitStart.slice(5, 7)) : null);
    if (annualMonth) {
      recurrence.annualMonth = annualMonth;
    } else {
      recurrence.annualMonth = todayDate.getMonth() + 1;
      inferredFields.push("startDate");
    }
  }

  const categoryName =
    matchCategoryName(item.categoryName, categories) ??
    detectCategoryFromText(`${name} ${item.description ?? ""}`) ??
    "General";
  if (!matchCategoryName(item.categoryName, categories)) inferredFields.push("categoryName");

  return {
    draft: {
      name,
      description: (item.description ?? "").trim().slice(0, 240),
      amount,
      categoryName,
      startDate,
      dueDay,
      recurrence,
    },
    missingFields,
    inferredFields: Array.from(new Set(inferredFields)),
  };
}
