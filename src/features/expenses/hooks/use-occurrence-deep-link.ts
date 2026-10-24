"use client";

import { useEffect, useRef, useState } from "react";
import { resolveBudgetCycle } from "@/domain/budget-cycle";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import { clampViewMonth } from "../lib/month-view";
import {
  deepLinkViewMonth,
  locateOccurrence,
  readOccurrenceParam,
  urlWithoutOccurrenceParam,
} from "../lib/occurrence-deep-link";

// Tiempo que la fila queda resaltada.
const HIGHLIGHT_MS = 4_000;

type DeepLinkRequest = {
  occurrenceId: string;
  // Mes al que se cambió para verlo; null hasta localizar el cobro.
  monthId: string | null;
};

type UseOccurrenceDeepLinkOptions = {
  store: ExpenseStore;
  language: AppLanguage;
  activeMonthId: string;
  viewMonthId: string;
  visibleOccurrences: ExpenseOccurrence[];
  showMonth: (monthId: string) => void;
  // Abre las acciones del cobro encontrado (la hoja de acciones).
  onOpen?: (occurrence: ExpenseOccurrence) => void;
  onMissing: () => void;
};

// Abre el cobro de /?occurrence=<id> (el enlace de una notificación): cambia
// al mes en que se ve, lo centra, le da el foco, lo resalta unos segundos y
// abre sus acciones. Si ya no está (borrado o saltado), lo dice. El parámetro
// se quita de la URL para que recargar o volver atrás no repita el salto.
export function useOccurrenceDeepLink({
  store,
  language,
  activeMonthId,
  viewMonthId,
  visibleOccurrences,
  showMonth,
  onOpen,
  onMissing,
}: UseOccurrenceDeepLinkOptions) {
  const [initialRequest] = useState<DeepLinkRequest | null>(() => {
    const occurrenceId = readOccurrenceParam(window.location.search);
    return occurrenceId ? { occurrenceId, monthId: null } : null;
  });
  const requestRef = useRef(initialRequest);
  const callbacks = useRef({ showMonth, onOpen, onMissing });
  useEffect(() => {
    callbacks.current = { showMonth, onOpen, onMissing };
  });

  useEffect(() => {
    const request = requestRef.current;
    if (!request) return;
    const visibleIds = new Set(visibleOccurrences.map((occurrence) => occurrence.id));
    let occurrenceId = request.occurrenceId;

    if (request.monthId === null) {
      window.history.replaceState(
        window.history.state,
        "",
        urlWithoutOccurrenceParam(window.location),
      );
      const occurrence = locateOccurrence(store, request.occurrenceId, language);
      if (!occurrence || occurrence.status === "skipped") {
        requestRef.current = null;
        callbacks.current.onMissing();
        return;
      }
      occurrenceId = occurrence.id;
      const monthId = clampViewMonth(
        deepLinkViewMonth(
          occurrence,
          viewMonthId,
          visibleIds,
          resolveBudgetCycle(store.finance),
        ),
        activeMonthId,
      );
      if (monthId !== viewMonthId) {
        // Se sigue en el siguiente render, con la lista de ese mes.
        requestRef.current = { occurrenceId, monthId };
        callbacks.current.showMonth(monthId);
        return;
      }
    }

    requestRef.current = null;
    const listed = visibleOccurrences.find((occurrence) => occurrence.id === occurrenceId);
    if (!listed) {
      callbacks.current.onMissing();
      return;
    }
    window.requestAnimationFrame(() => {
      // Primero la fila (y su foco), para que al cerrar las acciones el foco
      // vuelva a ella.
      highlightRow(occurrenceId);
      callbacks.current.onOpen?.(listed);
    });
  }, [activeMonthId, language, store, viewMonthId, visibleOccurrences]);

  // Al abrir con enlace, el desplazamiento inicial al día de hoy no compite.
  return { openedFromLink: initialRequest !== null };
}

function highlightRow(occurrenceId: string) {
  const row = Array.from(
    document.querySelectorAll<HTMLElement>("[data-expense-row-id]"),
  ).find((element) => element.dataset.expenseRowId === occurrenceId);
  if (!row) return;
  const reduceMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  row.dataset.highlighted = "true";
  row.focus({ preventScroll: true });
  row.scrollIntoView?.({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  window.setTimeout(() => {
    delete row.dataset.highlighted;
  }, HIGHLIGHT_MS);
}
