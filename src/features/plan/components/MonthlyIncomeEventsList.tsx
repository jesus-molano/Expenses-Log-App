import { TrendingUp } from "lucide-react";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { t } from "@/shared/i18n";
import { IncomeEventRow } from "./IncomeEventRow";
import { PlanEmptyTableRow, PlanSectionList } from "./PlanSectionList";

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
      <div className="app-monthly-table" data-tone="success">
        <div className="app-monthly-table-head">
          <span>{t("money.incomeItem", language)}</span>
          <span>{t("money.amountColumn", language)}</span>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </div>
        <div className="app-monthly-table-body" data-integrated-list="true">
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
            <PlanEmptyTableRow>
              {t("money.noOneOffForMonth", language)}
            </PlanEmptyTableRow>
          )}
        </div>
      </div>
    </PlanSectionList>
  );
}
