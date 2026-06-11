"use client";

import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { t } from "@/shared/i18n";
import { IncomeEventRow } from "./PlanCards";
import { PlanEmptyLine, PlanSectionList } from "./PlanSectionList";

type MonthlyIncomeEventsListProps = {
  language: AppLanguage;
  incomeEvents: IncomeEvent[];
  onDeleteIncomeEvent: (id: string) => void;
};

export function MonthlyIncomeEventsList({
  language,
  incomeEvents,
  onDeleteIncomeEvent,
}: MonthlyIncomeEventsListProps) {
  return (
    <PlanSectionList title={t("money.oneOffForMonth", language)}>
      {incomeEvents.length ? (
        incomeEvents.map((event) => (
          <IncomeEventRow
            key={event.id}
            name={event.name}
            date={event.receivedAt}
            amount={formatCurrency(event.amount)}
            removeLabel={t("money.removeIncome", language)}
            onRemove={() => onDeleteIncomeEvent(event.id)}
          />
        ))
      ) : (
        <PlanEmptyLine>{t("money.noOneOffForMonth", language)}</PlanEmptyLine>
      )}
    </PlanSectionList>
  );
}
