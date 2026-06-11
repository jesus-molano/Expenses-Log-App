"use client";

import { useMemo } from "react";
import type { ExpenseStore } from "@/domain/types";
import { buildAnnualPlanSummary } from "../lib/annual-plan-summary";

export function useAnnualPlanSummary(
  store: ExpenseStore,
  selectedYear: number,
  today: Date,
) {
  return useMemo(
    () => buildAnnualPlanSummary({ store, selectedYear, today }),
    [selectedYear, store, today],
  );
}
