"use client";

import { useMemo, useState } from "react";
import {
  readCloseDismissed,
  readViewMonth,
  writeCloseDismissed,
  writeViewMonth,
} from "@/data/persistence/month-view-store";
import {
  addMonthId,
  buildMonthContext,
  paymentSettlesMonth,
  shouldSuggestAdvance,
} from "@/domain/budget-month";
import { toDateOnly } from "@/domain/calendar";
import type { AppLanguage, ExpenseOccurrence, ExpenseStore } from "@/domain/types";
import { clampViewMonth, viewMonthBounds } from "../lib/month-view";

type UseActiveMonthOptions = {
  store: ExpenseStore;
  language: AppLanguage;
  now: Date;
  closeMonth: (monthId: string) => void;
  reopenMonth: (monthId: string) => void;
};

// Mes activo (el natural, o el siguiente si el natural está cerrado), mes que
// se mira y propuesta de pasar de mes cuando el natural ya está al día.
export function useActiveMonth({
  store,
  language,
  now,
  closeMonth,
  reopenMonth,
}: UseActiveMonthOptions) {
  const todayKey = toDateOnly(now);
  const context = useMemo(
    () => buildMonthContext(store, todayKey, language),
    [language, store, todayKey],
  );
  const { calendarMonthId, activeMonthId } = context;
  const [viewOverride, setViewOverride] = useState(readViewMonth);
  const [dismissedNow, setDismissedNow] = useState<string[]>([]);
  const viewMonthId = viewOverride
    ? clampViewMonth(viewOverride, activeMonthId)
    : activeMonthId;
  const bounds = viewMonthBounds(activeMonthId);
  const canSuggest =
    activeMonthId === calendarMonthId &&
    !dismissedNow.includes(calendarMonthId) &&
    !readCloseDismissed(calendarMonthId);

  function setView(monthId: string | null) {
    const next = monthId === activeMonthId ? null : monthId;
    setViewOverride(next);
    writeViewMonth(next);
  }

  return {
    ...context,
    viewMonthId,
    canBrowseBack: viewMonthId > bounds.min,
    canBrowseForward: viewMonthId < bounds.max,
    suggestAdvance:
      canSuggest &&
      shouldSuggestAdvance({
        status: context.closeStatus,
        today: context.today,
        payday: context.payday,
      }),
    settlesMonth: (occurrence: ExpenseOccurrence) =>
      canSuggest && paymentSettlesMonth(context, occurrence),
    browse: (delta: number) =>
      setView(clampViewMonth(addMonthId(viewMonthId, delta), activeMonthId)),
    // Mirar un mes concreto (el de un cobro abierto desde un aviso).
    show: (monthId: string) => setView(clampViewMonth(monthId, activeMonthId)),
    reset: () => setView(null),
    advance: () => {
      closeMonth(calendarMonthId);
      setView(null);
    },
    reopen: () => {
      reopenMonth(calendarMonthId);
      setView(null);
    },
    dismiss: () => {
      writeCloseDismissed(calendarMonthId);
      setDismissedNow((months) => [...months, calendarMonthId]);
    },
  };
}
