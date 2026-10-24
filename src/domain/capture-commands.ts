import { addMonths, parseISO } from "date-fns";
import { addMonthId, periodRange, type BudgetCycle } from "./budget-cycle";
import { activeBudgetMonth, canMoveOccurrence, occurrenceMoveRange } from "./budget-month";
import { buildDateWithDay, normalizeDateOnly, toDateOnly } from "./calendar";
import { occurrencesDueBetween, paidAmount } from "./finance";
import { foldText, wordsOf } from "./text";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore, ExpenseTemplate } from "./types";

// Qué pide una frase de la captura: dar de alta un gasto (lo normal) o actuar
// sobre uno que ya existe.
export type CaptureIntent = "create" | "pay" | "skip" | "move";

// Orden sobre un gasto existente ("marca la luz pagada 71,20", "salta el
// gimnasio este mes", "mueve Netflix al 10"). Nunca se aplica sin que el
// usuario la confirme.
export type CaptureCommand = {
  intent: Exclude<CaptureIntent, "create">;
  // El gasto tal como se nombró.
  target: string;
  // pay: lo pagado, si se dice (si no, el importe previsto).
  amount: number | null;
  // move: día nuevo del mes, o fecha nueva completa.
  day: number | null;
  date: string | null;
  // Mes del cobro al que se refiere (1-12). null: el mes que se está mirando.
  month: number | null;
};

export type CommandIssue =
  | "notFound"
  | "ambiguous"
  | "noOccurrence"
  | "alreadyPaid"
  | "alreadySkipped"
  | "sameDate"
  | "missingDate"
  | "closedMonth"
  | "tooFar";

export type ResolvedCaptureCommand = {
  command: CaptureCommand;
  templateId: string | null;
  // Series candidatas, de la más parecida a la menos, para elegir a mano.
  candidates: string[];
  occurrence: ExpenseOccurrence | null;
  // pay: importe que se registrará.
  amount: number | null;
  // move: nueva fecha de cobro.
  newDueDate: string | null;
  // move: se puede aplicar también a los siguientes (mensual, mismo mes).
  canMoveSeries: boolean;
  issue: CommandIssue | null;
};

function validDay(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 31
    ? value
    : null;
}

function validMonth(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12
    ? value
    : null;
}

// Normaliza una orden que llega de la IA o del parser local. Sin gasto al
// que referirse no es una orden utilizable.
export function normalizeCaptureCommand(raw: {
  intent?: CaptureIntent | null;
  name: string | null;
  amount: number | null;
  dueDay: number | null;
  startDate: string | null;
  annualMonth: number | null;
}): CaptureCommand | null {
  if (raw.intent !== "pay" && raw.intent !== "skip" && raw.intent !== "move") return null;
  const target = (raw.name ?? "").trim().slice(0, 80);
  if (!target) return null;
  const amount =
    raw.intent === "pay" && typeof raw.amount === "number" && Number.isFinite(raw.amount) && raw.amount > 0
      ? Math.round(raw.amount * 100) / 100
      : null;
  return {
    intent: raw.intent,
    target,
    amount,
    day: raw.intent === "move" ? validDay(raw.dueDay) : null,
    date: raw.intent === "move" ? normalizeDateOnly(raw.startDate) ?? null : null,
    month: validMonth(raw.annualMonth),
  };
}

// Las órdenes que devuelve el servidor, revalidadas en el cliente.
export function sanitizeCaptureCommands(value: unknown): CaptureCommand[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const command = normalizeCaptureCommand({
      intent: item.intent as CaptureIntent,
      name: typeof item.target === "string" ? item.target : null,
      amount: typeof item.amount === "number" ? item.amount : null,
      dueDay: typeof item.day === "number" ? item.day : null,
      startDate: typeof item.date === "string" ? item.date : null,
      annualMonth: typeof item.month === "number" ? item.month : null,
    });
    return command ? [command] : [];
  });
}

// Parecido entre lo que se dijo y el nombre de una serie: igual, uno
// contiene al otro (por palabras) o comparten alguna palabra significativa.
function matchScore(target: string, name: string) {
  const foldedTarget = foldText(target);
  const foldedName = foldText(name);
  if (!foldedTarget || !foldedName) return 0;
  if (foldedTarget === foldedName) return 100;
  const targetWords = wordsOf(foldedTarget);
  const nameWords = wordsOf(foldedName);
  const shared = nameWords.filter((word) => targetWords.includes(word));
  if (shared.length === nameWords.length || shared.length === targetWords.length) {
    return 60 + shared.length;
  }
  if (foldedName.startsWith(foldedTarget) || foldedTarget.startsWith(foldedName)) {
    return Math.min(foldedTarget.length, foldedName.length) >= 3 ? 50 : 0;
  }
  const meaningful = shared.filter((word) => word.length >= 3);
  return meaningful.length ? 20 + meaningful.length : 0;
}

export function rankTemplatesForTarget(target: string, templates: ExpenseTemplate[]) {
  return templates
    .filter((template) => template.active)
    .map((template) => ({ template, score: matchScore(target, template.name) }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.template.name.localeCompare(right.template.name, "es", { sensitivity: "base" }),
    );
}

// Mes en el que se busca el cobro de una orden: el nombrado o, si no, el que
// se mira.
export function commandMonthId(command: Pick<CaptureCommand, "month">, viewMonthId: string) {
  return command.month ? nearestMonthId(command.month, viewMonthId) : viewMonthId;
}

// El mes (1-12) más cercano al que se mira: en octubre, "enero" es el de
// después y "septiembre" el de antes.
function nearestMonthId(month: number, viewMonthId: string) {
  const year = Number(viewMonthId.slice(0, 4));
  const candidates = [year - 1, year, year + 1].map(
    (candidate) => `${candidate}-${String(month).padStart(2, "0")}`,
  );
  const distance = (monthId: string) =>
    Math.abs(
      (Number(monthId.slice(0, 4)) - year) * 12 +
        Number(monthId.slice(5, 7)) -
        Number(viewMonthId.slice(5, 7)),
    );
  return candidates.sort((left, right) => distance(left) - distance(right))[0];
}

// Con varios cobros en el mes (semanal, por ejemplo), el primero pendiente.
function pickOccurrence(occurrences: ExpenseOccurrence[]) {
  return occurrences.find((occurrence) => occurrence.status === "due") ?? occurrences[0] ?? null;
}

// `monthId` es un mes de presupuesto: con el ciclo anclado al cobro, sus días
// son los del ciclo, como en Gastos.
function findOccurrence(
  store: ExpenseStore,
  templateId: string,
  command: CaptureCommand,
  {
    monthId,
    today,
    language,
    cycle,
  }: { monthId: string; today: string; language: AppLanguage; cycle: BudgetCycle },
) {
  const { start, end } = periodRange(commandMonthId(command, monthId), cycle);
  const inMonth = occurrencesDueBetween(store, start, end, language).filter(
    (occurrence) => occurrence.template.id === templateId,
  );
  if (inMonth.length || command.month) return pickOccurrence(inMonth);

  // Sin mes dicho y sin cobro en el que se mira (un anual, por ejemplo): el
  // pendiente más cercano desde el mes anterior o, para mover, el siguiente.
  const from = periodRange(addMonthId(monthId, -1), cycle).start;
  const to = toDateOnly(addMonths(parseISO(today), 13));
  const around = occurrencesDueBetween(store, from, to, language).filter(
    (occurrence) => occurrence.template.id === templateId,
  );
  if (command.intent === "move") {
    return around.find((occurrence) => occurrence.dueDate >= today) ?? null;
  }
  return (
    around.find((occurrence) => occurrence.status === "due") ??
    around.find((occurrence) => occurrence.dueDate >= today) ??
    null
  );
}

const SERIES_FREQUENCIES = new Set(["monthly"]);

// Busca la serie y el cobro de una orden y dice si se puede aplicar. Con
// `templateId` se usa la serie elegida a mano.
export function resolveCaptureCommand(
  command: CaptureCommand,
  store: ExpenseStore,
  {
    today,
    monthId,
    language = "es",
    templateId,
  }: { today: string; monthId: string; language?: AppLanguage; templateId?: string | null },
): ResolvedCaptureCommand {
  const ranked = rankTemplatesForTarget(command.target, store.templates);
  const candidates = ranked.map((entry) => entry.template.id);
  const base = {
    command,
    candidates,
    occurrence: null,
    amount: null,
    newDueDate: null,
    canMoveSeries: false,
  };

  let chosen = templateId ? store.templates.find((template) => template.id === templateId) : undefined;
  if (!chosen) {
    const [best, second] = ranked;
    if (!best || best.score === 0) return { ...base, templateId: null, issue: "notFound" };
    if (second && second.score === best.score) {
      return { ...base, templateId: null, issue: "ambiguous" };
    }
    chosen = best.template;
  }

  // El mes abierto, con el mismo ciclo que Gastos: el de presupuesto en que
  // cae hoy, o el siguiente si ese ya se cerró.
  const { monthId: openMonth, cycle } = activeBudgetMonth(store.finance, today);
  const occurrence = findOccurrence(store, chosen.id, command, {
    monthId,
    today,
    language,
    cycle,
  });
  if (!occurrence) return { ...base, templateId: chosen.id, issue: "noOccurrence" };

  const resolved = { ...base, templateId: chosen.id, occurrence };
  const occurrenceMonth = occurrence.dueDate.slice(0, 7);

  if (command.intent === "pay") {
    // Ya pagado y sin importe dicho: se queda lo pagado (un recibo variable
    // no vuelve a lo previsto). Otro importe corrige lo pagado.
    const paidBefore = occurrence.status === "paid" ? paidAmount(occurrence) : null;
    const amount = command.amount ?? paidBefore ?? occurrence.template.amount;
    const alreadyPaid = paidBefore !== null && paidBefore === amount;
    return { ...resolved, amount, issue: alreadyPaid ? "alreadyPaid" : null };
  }

  if (command.intent === "skip") {
    const issue =
      occurrence.status === "skipped"
        ? "alreadySkipped"
        : occurrence.status === "paid"
          ? "alreadyPaid"
          : null;
    return { ...resolved, issue };
  }

  const newDueDate =
    command.date ??
    (command.day
      ? toDateOnly(buildDateWithDay(parseISO(`${occurrenceMonth}-01`), command.day))
      : null);
  // Los mismos límites que al mover desde las acciones del cobro.
  const moveRange = occurrenceMoveRange(openMonth, cycle, today);
  const issue: CommandIssue | null = !newDueDate
    ? "missingDate"
    : newDueDate === occurrence.dueDate
      ? "sameDate"
      : newDueDate < moveRange.min || !canMoveOccurrence(occurrence, openMonth, cycle, today)
        ? "closedMonth"
        : newDueDate > moveRange.max
          ? "tooFar"
          : null;
  // Como al arrastrar: la serie solo cambia con un mensual que se queda en su
  // mes y no es historial (no es anterior al mes abierto).
  const canMoveSeries = Boolean(
    newDueDate &&
      !occurrence.record &&
      SERIES_FREQUENCIES.has(occurrence.template.recurrence.frequency) &&
      newDueDate.slice(0, 7) === occurrenceMonth &&
      occurrence.dueDate >= moveRange.min,
  );
  return { ...resolved, newDueDate, canMoveSeries, issue };
}
