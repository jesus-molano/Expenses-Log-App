"use client";

import { useMemo, useState } from "react";
import { addMonthId, buildMonthPlan, monthRange } from "@/domain/budget-month";
import {
  getMonthlySavingsContribution,
  getMonthlySavingsTarget,
  occurrencesDueBetween,
} from "@/domain/finance";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import { formatMoneyInput, parseMoneyInput } from "@/shared/money";
import type { MonthlySavingsContributionInput } from "@/stores/app/store-types";
import {
  buildLeftoverRows,
  leftoverMoveDate,
  snapshotLeftovers,
  type LeftoverRow,
  type LeftoverSnapshot,
} from "../lib/month-close";

type MonthCloseCommands = {
  togglePaid: (occurrence: ExpenseOccurrence) => void;
  skipOccurrence: (occurrence: ExpenseOccurrence) => void;
  restoreOccurrence: (occurrence: ExpenseOccurrence) => void;
  moveOccurrence: (occurrence: ExpenseOccurrence, dueDate: string) => void;
  markOccurrencesPaid: (occurrences: ExpenseOccurrence[]) => void;
  updateMonthlySavingsContribution: (input: MonthlySavingsContributionInput) => void;
};

// Hoja de cierre del mes con restos: resumen frente al plan, qué pasó con
// cada recibo pendiente, ahorro real del mes y paso al siguiente. Cada
// decisión se guarda al momento y se puede deshacer en su fila.
export function useMonthCloseSheet({
  store,
  monthId,
  today,
  language,
  commands,
  onStart,
}: {
  store: ExpenseStore;
  // Mes que se cierra al abrir la hoja (el natural).
  monthId: string;
  today: string;
  language: AppLanguage;
  commands: MonthCloseCommands;
  // Pasa al mes siguiente (cierre, aviso con deshacer y foco). Recibe el mes
  // con el que se abrió la hoja: si entretanto cambió el mes natural, no hay
  // que cerrar el nuevo.
  onStart: (closedMonthId: string) => void;
}) {
  // El mes y los restos se fijan al abrir: la lista no cambia de forma
  // mientras se resuelve y medianoche no cambia de mes la hoja abierta.
  const [session, setSession] = useState<{
    monthId: string;
    snapshot: LeftoverSnapshot[];
  } | null>(null);
  const [savingsText, setSavingsText] = useState("");
  const isOpen = session !== null;
  const sessionMonthId = session?.monthId ?? monthId;

  // Los movidos al mes siguiente se siguen buscando para poder deshacerlos.
  const occurrences = useMemo(
    () =>
      isOpen
        ? occurrencesDueBetween(
            store,
            monthRange(sessionMonthId).start,
            monthRange(addMonthId(sessionMonthId, 1)).end,
            language,
          )
        : [],
    [isOpen, language, sessionMonthId, store],
  );
  const rows = useMemo(
    () => buildLeftoverRows(session?.snapshot ?? [], occurrences, sessionMonthId),
    [occurrences, session, sessionMonthId],
  );
  const plan = useMemo(
    () => (isOpen ? buildMonthPlan(store, sessionMonthId, { today, language }) : null),
    [isOpen, language, sessionMonthId, store, today],
  );
  const savedContribution = getMonthlySavingsContribution(store.finance, sessionMonthId);
  const savingsAmount = parseMoneyInput(savingsText);
  const savingsInvalid = savingsText.trim() !== "" && savingsAmount === null;

  function open(leftovers: ExpenseOccurrence[]) {
    const contribution = getMonthlySavingsContribution(store.finance, monthId);
    setSession({ monthId, snapshot: snapshotLeftovers(leftovers) });
    setSavingsText(contribution ? formatMoneyInput(contribution.amount, language) : "");
  }

  function undo(row: LeftoverRow) {
    if (row.resolution === "paid") commands.togglePaid(row.occurrence);
    if (row.resolution === "skipped") commands.restoreOccurrence(row.occurrence);
    if (row.resolution === "moved") {
      commands.moveOccurrence(row.occurrence, row.snapshot.dueDate);
    }
  }

  // Vacío no toca el ahorro; un importe ilegible no deja empezar el mes.
  function start() {
    if (savingsInvalid) return false;
    if (savingsAmount !== null && savingsAmount !== (savedContribution?.amount ?? 0)) {
      commands.updateMonthlySavingsContribution({
        monthId: sessionMonthId,
        amount: savingsAmount,
      });
    }
    setSession(null);
    onStart(sessionMonthId);
    return true;
  }

  return {
    isOpen,
    rows,
    plan,
    monthId: sessionMonthId,
    savingsTarget: getMonthlySavingsTarget(store.finance, sessionMonthId),
    savingsText,
    savingsInvalid,
    setSavingsText,
    open,
    close: () => setSession(null),
    pay: (row: LeftoverRow) => commands.togglePaid(row.occurrence),
    skip: (row: LeftoverRow) => commands.skipOccurrence(row.occurrence),
    move: (row: LeftoverRow) =>
      commands.moveOccurrence(row.occurrence, leftoverMoveDate(sessionMonthId)),
    payAll: () =>
      commands.markOccurrencesPaid(
        rows.filter((row) => row.resolution === "pending").map((row) => row.occurrence),
      ),
    undo,
    start,
  };
}
