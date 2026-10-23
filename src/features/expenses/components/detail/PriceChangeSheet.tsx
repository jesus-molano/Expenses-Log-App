"use client";

import type { FormEvent } from "react";
import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeading } from "@/components/ui/SheetHeading";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { formatPriceMonth } from "../../lib/series-format";

type PriceChangeSheetProps = {
  name: string;
  monthId: string;
  monthChoices: string[];
  amountText: string;
  language: AppLanguage;
  onMonthChange: (monthId: string) => void;
  onAmountTextChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

// "Desde marzo cuesta 15 €": mes y nuevo importe.
export function PriceChangeSheet({
  name,
  monthId,
  monthChoices,
  amountText,
  language,
  onMonthChange,
  onAmountTextChange,
  onSubmit,
  onClose,
}: PriceChangeSheetProps) {
  const titleId = useId();

  return (
    <Sheet ariaLabelledBy={titleId} contentClassName="sm:max-w-md" onBackdropClick={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4 p-5">
        <SheetHeading
          id={titleId}
          title={`${t("bills.priceScheduleTitle", language)} · ${name}`}
          subtitle={t("bills.priceScheduleBody", language)}
          closeLabel={t("common.close", language)}
          onClose={onClose}
        />
        <ChoiceGroup
          label={t("bills.priceFromMonth", language)}
          value={monthId}
          columns={3}
          options={monthChoices.map((choice) => ({
            value: choice,
            label: formatPriceMonth(`${choice}-01`, language),
          }))}
          onChange={onMonthChange}
        />
        <Field label={t("bills.priceNewAmount", language)}>
          <MoneyInput
            value={amountText}
            onValueChange={onAmountTextChange}
            invalidMessage={t("bills.payInvalid", language)}
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full">
          {t("bills.priceSave", language)}
        </Button>
      </form>
    </Sheet>
  );
}
