"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeading } from "@/components/ui/SheetHeading";
import type { ChargeChoice } from "@/domain/series-lifecycle";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatChargeDate } from "../../lib/series-format";

type EndSeriesSheetProps = {
  name: string;
  choices: ChargeChoice[];
  selected: string;
  language: AppLanguage;
  today: string;
  onSelect: (date: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

// "Finalizar": la serie termina tras el cobro elegido (incluido).
export function EndSeriesSheet({
  name,
  choices,
  selected,
  language,
  today,
  onSelect,
  onConfirm,
  onClose,
}: EndSeriesSheetProps) {
  const titleId = useId();

  return (
    <Sheet ariaLabelledBy={titleId} contentClassName="sm:max-w-md" onBackdropClick={onClose}>
      <div className="grid gap-4 p-5">
        <SheetHeading
          id={titleId}
          title={t("bills.finishTitle", language).replace("{name}", name)}
          subtitle={t("bills.finishBody", language)}
          closeLabel={t("common.close", language)}
          onClose={onClose}
        />
        {choices.length ? (
          <ChoiceGroup
            label={t("bills.finishLastCharge", language)}
            value={selected}
            options={choices.map((choice) => ({
              value: choice.date,
              label: formatChargeDate(choice.date, language, today),
              description: choice.paid ? t("bills.chargePaid", language) : undefined,
            }))}
            onChange={onSelect}
          />
        ) : (
          <p className="text-sm text-[var(--app-text-muted)]">
            {t("bills.noUpcomingCharges", language)}
          </p>
        )}
        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={!selected}
          onClick={onConfirm}
        >
          {t("bills.finishConfirm", language)}
        </Button>
      </div>
    </Sheet>
  );
}
