"use client";

import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { IncomeEventInput } from "@/stores/app/store-types";
import type { useOneOffIncomeForm } from "../hooks/use-one-off-income-form";
import { OneOffIncomePanel } from "./OneOffIncomePanel";
import { PlanSheetHeader } from "./PlanSheetHeader";

// "Añadir ingreso extra" del mes que se mira, con los que ya tiene.
export function ExtraIncomeSheet({
  form,
  extraIncomeTotal,
  incomeEvents,
  language,
  onDeleteIncomeEvent,
  onUpdateIncomeEvent,
  onClose,
}: {
  form: ReturnType<typeof useOneOffIncomeForm>;
  extraIncomeTotal: number;
  incomeEvents: IncomeEvent[];
  language: AppLanguage;
  onDeleteIncomeEvent: (id: string) => void;
  onUpdateIncomeEvent: (id: string, input: IncomeEventInput) => void;
  onClose: () => void;
}) {
  return (
    <Sheet ariaLabel={t("plan.extraIncome", language)} onBackdropClick={onClose}>
      <div className="p-5">
        <PlanSheetHeader
          title={t("plan.extraIncome", language)}
          onClose={onClose}
          language={language}
        />
        <div className="mt-5">
          <OneOffIncomePanel
            language={language}
            extraIncomeTotal={extraIncomeTotal}
            incomeEvents={incomeEvents}
            extraName={form.extraName}
            extraAmount={form.extraAmount}
            onExtraNameChange={form.setExtraName}
            onExtraAmountChange={form.setExtraAmount}
            onSubmit={form.saveExtra}
            onDeleteIncomeEvent={onDeleteIncomeEvent}
            onUpdateIncomeEvent={onUpdateIncomeEvent}
          />
        </div>
      </div>
    </Sheet>
  );
}
