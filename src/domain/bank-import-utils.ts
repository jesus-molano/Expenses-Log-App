import { differenceInCalendarDays, parseISO } from "date-fns";
import { buildDateWithDay, estimateChargeDate, toDateOnly } from "./calendar";
import type { BankMovement } from "./types";

export type BankImportDuplicateInfo = {
  source: "existing" | "import";
  movement?: BankMovement;
  reason: string;
};

export function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

export function inferRecurringDueDay(movements: BankMovement[]) {
  if (!movements.length) return null;

  const scoredDays = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const score = movements.reduce(
      (sum, movement) => sum + weekendAwareDayDistance(movement.bookedAt, day),
      0,
    );

    return { day, score };
  }).sort((a, b) => a.score - b.score || a.day - b.day);

  return scoredDays[0]?.score <= movements.length * 2 ? scoredDays[0].day : null;
}

export function titleFromMovement(movement: BankMovement, fallback: string) {
  return (
    movement.merchantKey
      .split(" ")
      .filter(Boolean)
      .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
      .join(" ") || fallback
  );
}

function weekendAwareDayDistance(bookedAt: string, dueDay: number) {
  const bookedDate = parseISO(bookedAt);
  const dueDate = toDateOnly(buildDateWithDay(bookedDate, dueDay));
  const estimatedCharge = estimateChargeDate(dueDate).date;

  return Math.min(
    Math.abs(differenceInCalendarDays(bookedDate, parseISO(dueDate))),
    Math.abs(differenceInCalendarDays(bookedDate, parseISO(estimatedCharge))),
  );
}
