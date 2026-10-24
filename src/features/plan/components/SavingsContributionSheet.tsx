"use client";

import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { formatMonthName } from "@/features/expenses/lib/month-view";
import { t } from "@/shared/i18n";
import type { SavingsContributionEditor } from "../hooks/use-savings-contribution-editor";
import { PlanSheetHeader } from "./PlanSheetHeader";

// "Editar ahorro" de un mes con el estado de `useSavingsContributionEditor`.
// No pinta nada mientras está cerrada.
export function SavingsContributionSheet({
  editor,
  language,
}: {
  editor: SavingsContributionEditor;
  language: AppLanguage;
}) {
  if (!editor.monthId) return null;

  return (
    <Sheet
      ariaLabel={t("plan.editSavings", language)}
      onBackdropClick={editor.close}
      contentClassName="sm:max-w-sm"
    >
      <form onSubmit={editor.submit} className="p-5">
        <PlanSheetHeader
          title={t("plan.editSavings", language)}
          subtitle={formatMonthName(editor.monthId, language, { withYear: true })}
          onClose={editor.close}
          language={language}
        />
        <p className="mt-5 text-sm text-[var(--app-text-muted)]">
          {t("plan.monthlyGoal", language)}:{" "}
          <span className="app-money font-semibold text-[var(--app-text)]">
            {formatCurrency(editor.target)}
          </span>
        </p>
        <label className="mt-4 grid gap-1.5 text-sm font-semibold text-[var(--app-text-muted)]">
          {t("plan.actualTransfer", language)}
          <MoneyInput
            value={editor.actualText}
            allowZero
            onValueChange={editor.setActualText}
            invalidMessage={t("money.amountInvalid", language)}
          />
        </label>
        {editor.legacyWithoutDate ? (
          <p className="mt-3 text-xs text-[var(--app-warning)]">
            {t("plan.legacySavingDate", language)}
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-[var(--app-text-muted)]">
          {t("plan.singleContribution", language)}
        </p>
        <Button type="submit" variant="primary" className="mt-5 w-full">
          {t("plan.saveSavings", language)}
        </Button>
      </form>
    </Sheet>
  );
}
