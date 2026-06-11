"use client";

import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { t } from "@/shared/i18n";
import { IncomeEventRow } from "./PlanCards";

type OneOffIncomePanelProps = {
  language: AppLanguage;
  extraIncomeTotal: number;
  incomeEvents: IncomeEvent[];
  extraName: string;
  extraAmount: string;
  onExtraNameChange: (value: string) => void;
  onExtraAmountChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteIncomeEvent: (id: string) => void;
};

export function OneOffIncomePanel({
  language,
  extraIncomeTotal,
  incomeEvents,
  extraName,
  extraAmount,
  onExtraNameChange,
  onExtraAmountChange,
  onSubmit,
  onDeleteIncomeEvent,
}: OneOffIncomePanelProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[1.35rem] border border-[var(--app-border)] bg-[var(--app-panel-alpha)] p-3 sm:p-4"
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--app-text)]">
        <Plus size={18} />
        {t("money.oneOffIncome", language)}
      </h2>
      <p className="mt-1 text-sm text-[var(--app-text-muted)]">
        {t("money.extrasThisMonth", language)}:{" "}
        {formatCurrency(extraIncomeTotal)}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem]">
        <input
          value={extraName}
          onChange={(event) => onExtraNameChange(event.target.value)}
          className="input-control"
          placeholder={t("money.extraNamePlaceholder", language)}
        />
        <input
          value={extraAmount}
          inputMode="decimal"
          onChange={(event) => onExtraAmountChange(event.target.value)}
          className="input-control"
          placeholder={t("money.extraAmountPlaceholder", language)}
        />
      </div>
      <button className="mt-3 h-12 w-full rounded-2xl bg-[var(--app-panel-soft-alpha)] text-sm font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)]">
        {t("money.addIncome", language)}
      </button>
      <div className="mt-4 grid gap-2">
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
          <p className="rounded-2xl bg-[var(--app-panel-soft-alpha)] px-3 py-2 text-sm font-medium text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)]">
            {t("money.noExtraIncome", language)}
          </p>
        )}
      </div>
    </form>
  );
}

