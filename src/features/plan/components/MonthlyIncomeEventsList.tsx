"use client";

import { TrendingUp } from "lucide-react";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { t } from "@/shared/i18n";
import { IncomeEventRow } from "./IncomeEventRow";
import { PlanEmptyLine, PlanSectionList } from "./PlanSectionList";

type MonthlyIncomeEventsListProps = {
  language: AppLanguage;
  incomeEvents: IncomeEvent[];
  onDeleteIncomeEvent: (id: string) => void;
  onUpdateIncomeEvent: (
    id: string,
    input: { name: string; amount: number; receivedAt: string; note?: string },
  ) => void;
};

export function MonthlyIncomeEventsList({
  language,
  incomeEvents,
  onDeleteIncomeEvent,
  onUpdateIncomeEvent,
}: MonthlyIncomeEventsListProps) {
  return (
    <PlanSectionList
      title={t("money.oneOffForMonth", language)}
      icon={TrendingUp}
      tone="success"
    >
      {incomeEvents.length ? (
        incomeEvents.map((event) => (
          <IncomeEventRow
            key={event.id}
            event={event}
            language={language}
            removeLabel={t("money.removeIncome", language)}
            onRemove={() => onDeleteIncomeEvent(event.id)}
            onUpdate={(input) => onUpdateIncomeEvent(event.id, input)}
          />
        ))
      ) : (
        <PlanEmptyLine>{t("money.noOneOffForMonth", language)}</PlanEmptyLine>
      )}
    </PlanSectionList>
  );
}
