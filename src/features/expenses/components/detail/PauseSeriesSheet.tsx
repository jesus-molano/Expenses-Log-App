"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeading } from "@/components/ui/SheetHeading";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { OPEN_PAUSE } from "../../hooks/use-pause-series-sheet";
import { formatChargeDate } from "../../lib/series-format";

type PauseSeriesSheetProps = {
  name: string;
  startChoices: string[];
  from: string;
  resumeOn: string;
  resumeChoices: string[];
  skippedCount: number | null;
  language: AppLanguage;
  today: string;
  onFromChange: (date: string) => void;
  onResumeChange: (date: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

// "Pausar": desde qué cobro y con cuál vuelve (o hasta reanudarla).
export function PauseSeriesSheet({
  name,
  startChoices,
  from,
  resumeOn,
  resumeChoices,
  skippedCount,
  language,
  today,
  onFromChange,
  onResumeChange,
  onConfirm,
  onClose,
}: PauseSeriesSheetProps) {
  const titleId = useId();
  const summary =
    skippedCount === null
      ? t("bills.pauseSkipsOpen", language)
      : skippedCount === 1
        ? t("bills.pauseSkipsOne", language)
        : t("bills.pauseSkipsMany", language).replace("{count}", String(skippedCount));

  return (
    <Sheet ariaLabelledBy={titleId} contentClassName="sm:max-w-md" onBackdropClick={onClose}>
      <div className="grid gap-4 p-5">
        <SheetHeading
          id={titleId}
          title={t("bills.pauseTitle", language).replace("{name}", name)}
          subtitle={t("bills.pauseBody", language)}
          closeLabel={t("common.close", language)}
          onClose={onClose}
        />
        {startChoices.length ? (
          <>
            <ChoiceGroup
              label={t("bills.pauseFrom", language)}
              value={from}
              options={startChoices.map((date) => ({
                value: date,
                label: formatChargeDate(date, language, today),
              }))}
              onChange={onFromChange}
            />
            <ChoiceGroup
              label={t("bills.pauseUntil", language)}
              value={resumeOn}
              options={[
                { value: OPEN_PAUSE, label: t("bills.pauseUntilResumed", language) },
                ...resumeChoices.map((date) => ({
                  value: date,
                  label: t("bills.pauseReturnsOn", language).replace(
                    "{date}",
                    formatChargeDate(date, language, today),
                  ),
                })),
              ]}
              onChange={onResumeChange}
            />
            <p aria-live="polite" className="text-sm text-[var(--app-text-muted)]">
              {summary}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--app-text-muted)]">
            {t("bills.noUpcomingCharges", language)}
          </p>
        )}
        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={!from}
          onClick={onConfirm}
        >
          {t("bills.pauseConfirm", language)}
        </Button>
      </div>
    </Sheet>
  );
}
