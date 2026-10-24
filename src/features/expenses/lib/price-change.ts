import { periodIdOf, periodStart, resolveBudgetCycle } from "@/domain/budget-cycle";
import type { ExpenseAmountChange, FinanceStore } from "@/domain/types";

// Cambio de precio programado con el mes de presupuesto en que empieza (el
// que se eligió al programarlo).
export type ScheduledPriceChange = ExpenseAmountChange & { monthId: string };

// Un precio "desde marzo" rige desde el primer día del mes de presupuesto de
// marzo: el día 1 con el ciclo natural, el día de cobro con el anclado al
// cobro (el mismo inicio que usa "desde el mes que viene" al editar el
// importe).
export function priceChangeStart(monthId: string, finance: FinanceStore) {
  return periodStart(monthId, resolveBudgetCycle(finance));
}

// Cambios que aún no han empezado, con su mes de presupuesto para nombrarlos.
export function scheduledPriceChanges(
  changes: ExpenseAmountChange[] | undefined,
  today: string,
  finance: FinanceStore,
): ScheduledPriceChange[] {
  const cycle = resolveBudgetCycle(finance);
  return (changes ?? [])
    .filter((change) => change.from > today)
    .map((change) => ({ ...change, monthId: periodIdOf(change.from, cycle) }));
}
