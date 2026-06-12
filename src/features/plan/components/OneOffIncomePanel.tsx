"use client";

import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
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
  onUpdateIncomeEvent: (
    id: string,
    input: { name: string; amount: number; receivedAt: string; note?: string },
  ) => void;
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
  onUpdateIncomeEvent,
}: OneOffIncomePanelProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid min-w-0 gap-4"
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

      <div className="app-section-card grid gap-3 p-3">
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
          <Button type="submit" size="lg" variant="secondary">
            {t("money.addIncome", language)}
          </Button>
        </div>
      </div>
      <div className="grid gap-2.5">
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
          <Surface variant="empty" className="px-3 py-2 text-sm font-medium">
            {t("money.noExtraIncome", language)}
          </Surface>
        )}
      </div>
    </form>
  );
}

