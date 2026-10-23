"use client";

import type { AppLanguage, ExpenseTemplate } from "@/domain/types";
import type { useExpenseStore } from "@/stores/app/use-expense-store";
import { useSeriesDetail } from "../../hooks/use-series-detail";
import { PayAmountSheet } from "../PayAmountSheet";
import { ChargeHistoryCard } from "./ChargeHistoryCard";
import { EndSeriesSheet } from "./EndSeriesSheet";
import { PauseSeriesSheet } from "./PauseSeriesSheet";
import { PriceCard } from "./PriceCard";
import { PriceChangeSheet } from "./PriceChangeSheet";
import { SeriesLifecycleCard } from "./SeriesLifecycleCard";

type SeriesDetailSectionsProps = {
  template: ExpenseTemplate;
  expenseStore: ReturnType<typeof useExpenseStore>;
  language: AppLanguage;
  now: Date;
};

// Bajo el formulario del gasto: suscripción (finalizar, pausar), precio
// (cambios programados e historial) y últimos cobros (previsto frente a
// pagado). Cada acción se guarda al momento.
export function SeriesDetailSections({
  template,
  expenseStore,
  language,
  now,
}: SeriesDetailSectionsProps) {
  const detail = useSeriesDetail({ template, expenseStore, language, now });
  const { endSheet, pauseSheet, priceSheet, payFlow } = detail;

  return (
    <>
      {detail.repeats ? (
        <SeriesLifecycleCard
          lifecycle={detail.lifecycle}
          language={language}
          today={detail.today}
          onFinish={endSheet.openSheet}
          onReactivate={detail.reactivate}
          onPause={pauseSheet.openSheet}
          onResume={detail.resume}
          onRemovePause={detail.removePause}
        />
      ) : null}

      {detail.repeats ? (
        <PriceCard
          currentAmount={detail.currentAmount}
          scheduled={detail.scheduledChanges}
          history={detail.priceHistory}
          language={language}
          onSchedule={priceSheet.openSheet}
          onRemove={detail.removeAmountChange}
        />
      ) : null}

      <ChargeHistoryCard
        entries={detail.recentCharges}
        average={detail.average}
        language={language}
        today={detail.today}
        onPay={payFlow.open}
      />

      {endSheet.open ? (
        <EndSeriesSheet
          name={template.name}
          choices={endSheet.choices}
          selected={endSheet.selected}
          language={language}
          today={detail.today}
          onSelect={endSheet.setSelected}
          onConfirm={endSheet.confirm}
          onClose={endSheet.close}
        />
      ) : null}

      {pauseSheet.open ? (
        <PauseSeriesSheet
          name={template.name}
          startChoices={pauseSheet.startChoices}
          from={pauseSheet.from}
          resumeOn={pauseSheet.resumeOn}
          resumeChoices={pauseSheet.resumeChoices}
          skippedCount={pauseSheet.skippedCount}
          language={language}
          today={detail.today}
          onFromChange={pauseSheet.setFrom}
          onResumeChange={pauseSheet.setResumeOn}
          onConfirm={pauseSheet.confirm}
          onClose={pauseSheet.close}
        />
      ) : null}

      {priceSheet.open ? (
        <PriceChangeSheet
          name={template.name}
          monthId={priceSheet.monthId}
          monthChoices={priceSheet.monthChoices}
          amountText={priceSheet.amountText}
          language={language}
          onMonthChange={priceSheet.setMonthId}
          onAmountTextChange={priceSheet.setAmountText}
          onSubmit={priceSheet.save}
          onClose={priceSheet.close}
        />
      ) : null}

      {payFlow.occurrence ? (
        <PayAmountSheet
          occurrence={payFlow.occurrence}
          amountText={payFlow.amountText}
          suggestion={payFlow.suggestion}
          seriesPrompt={payFlow.seriesPrompt}
          language={language}
          today={detail.today}
          onAmountTextChange={payFlow.setAmountText}
          onSubmit={payFlow.save}
          onApplySeries={payFlow.applySeries}
          onClose={payFlow.close}
        />
      ) : null}
    </>
  );
}
