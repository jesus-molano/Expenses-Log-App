"use client";

import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, IncomeEvent } from "@/domain/types";
import { t } from "@/shared/i18n";
import { IncomeEventRow } from "./IncomeEventRow";

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
      className="rounded-[1.2rem] border border-[var(--app-border)] bg-[var(--app-panel-alpha)] p-3"
    >
      <header className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-[var(--app-text)]">
          <Plus size={17} />
          <span className="truncate">{t("money.oneOffIncome", language)}</span>
        </h2>
        <p className="shrink-0 text-right text-xs font-semibold text-[var(--app-text-muted)]">
          {formatCurrency(extraIncomeTotal)}
        </p>
      </header>

      <div className="mt-3 grid gap-2">
        <input
          value={extraName}
          onChange={(event) => onExtraNameChange(event.target.value)}
          className="input-control"
          placeholder={t("money.extraNamePlaceholder", language)}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={extraAmount}
            inputMode="decimal"
            onChange={(event) => onExtraAmountChange(event.target.value)}
            className="input-control min-w-0"
            placeholder={t("money.extraAmountPlaceholder", language)}
          />
          <button className="h-12 rounded-2xl bg-[var(--app-panel-soft-alpha)] px-4 text-sm font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)] transition hover:bg-[color-mix(in_srgb,var(--app-text)_10%,transparent)]">
            {t("money.addIncome", language)}
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
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

