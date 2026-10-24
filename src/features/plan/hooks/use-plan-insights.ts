"use client";

import { useMemo } from "react";
import type { BudgetCycle } from "@/domain/budget-cycle";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { buildLargeUpcomingBills, buildProvisionPlan } from "../lib/bill-forecast";
import { buildRecurringCostInsights } from "../lib/recurring-costs";

// Previsiones (pestaña Previsión) a partir del mes activo: recibos grandes de los
// próximos 90 días, provisión para los no mensuales y coste por categoría.
export function usePlanInsights({
  store,
  monthId,
  cycle,
  today,
  language,
}: {
  store: ExpenseStore;
  monthId: string;
  cycle: BudgetCycle;
  today: string;
  language: AppLanguage;
}) {
  return useMemo(
    () => ({
      largeBills: buildLargeUpcomingBills(store, { today, language }),
      provision: buildProvisionPlan(store, { monthId, cycle, language }),
      costs: buildRecurringCostInsights(store, { monthId, cycle, language }),
    }),
    [cycle, language, monthId, store, today],
  );
}
