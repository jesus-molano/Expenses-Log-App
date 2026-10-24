"use client";

import { ArrowDownRight, ArrowUpRight, Minus, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { capitalize, formatMonthName } from "@/features/expenses/lib/month-view";
import { t } from "@/shared/i18n";
import { formatSignedCurrency } from "../lib/insight-format";
import type {
  MonthSummary,
  MonthSummaryChange,
  MonthSummaryChangeKind,
} from "../lib/month-summary";
import { PlanSheetHeader } from "./PlanSheetHeader";

const changeIcons: Record<MonthSummaryChangeKind, typeof Plus> = {
  new: Plus,
  gone: Minus,
  up: ArrowUpRight,
  down: ArrowDownRight,
};

const changeLabelKeys = {
  new: "insights.summary.changeNew",
  gone: "insights.summary.changeGone",
  up: "insights.summary.changeUp",
  down: "insights.summary.changeDown",
} as const;

// Resumen de un mes al cerrarlo o desde Plan: lo previsto, lo pagado, lo que
// queda, lo ahorrado y los recibos que más cambian frente al mes anterior.
export function MonthSummarySheet({
  summary,
  language,
  periodLabel,
  onClose,
}: {
  summary: MonthSummary;
  language: AppLanguage;
  // "28 oct – 27 nov" cuando el mes empieza el día de cobro.
  periodLabel?: string | null;
  onClose: () => void;
}) {
  const month = formatMonthName(summary.monthId, language);
  const previousMonth = formatMonthName(summary.previousMonthId, language);
  const versus = (delta: number) =>
    t("insights.summary.versus", language)
      .replace("{delta}", formatSignedCurrency(delta, formatCurrency))
      .replace("{month}", previousMonth);

  return (
    <Sheet
      ariaLabelledBy="month-summary-title"
      onBackdropClick={onClose}
      contentClassName="sm:max-w-md"
    >
      <div className="p-5">
        <PlanSheetHeader
          title={capitalize(t("insights.summary.title", language).replace("{month}", month))}
          titleId="month-summary-title"
          subtitle={periodLabel ?? undefined}
          capitalizeSubtitle={false}
          onClose={onClose}
          language={language}
        />

        {summary.plannedCount === 0 ? (
          <p className="mt-5 text-sm text-[var(--app-text-muted)]">
            {t("insights.summary.empty", language).replace("{month}", month)}
          </p>
        ) : (
          <>
            <dl className="mt-5 grid grid-cols-2 gap-2">
              <StatTile
                label={t("insights.summary.planned", language)}
                value={summary.plannedTotal}
                detail={versus(summary.deltas.planned)}
              />
              <StatTile
                label={t("insights.summary.paid", language)}
                value={summary.paidTotal}
                detail={t("insights.summary.paidCount", language)
                  .replace("{paid}", String(summary.paidCount))
                  .replace("{total}", String(summary.plannedCount))}
              />
              <StatTile
                label={t("insights.summary.pending", language)}
                value={summary.pendingTotal}
                detail={t("insights.summary.pendingCount", language).replace(
                  "{count}",
                  String(summary.pendingCount),
                )}
              />
              <StatTile
                label={t("insights.summary.saved", language)}
                value={summary.savingsActual}
                detail={t("insights.summary.savedGoal", language).replace(
                  "{amount}",
                  formatCurrency(summary.savingsTarget),
                )}
              />
            </dl>
            {summary.skippedCount > 0 ? (
              <p className="mt-2 text-xs text-[var(--app-text-muted)]">
                {t("insights.summary.skippedCount", language).replace(
                  "{count}",
                  String(summary.skippedCount),
                )}
              </p>
            ) : null}

            <dl className="app-plan-equation mt-4 grid gap-1 p-2">
              <SummaryRow label={t("insights.summary.income", language)} value={summary.incomeTotal} />
              <SummaryRow
                label={t("insights.summary.free", language)}
                value={summary.freeAccordingToPlan}
              />
            </dl>

            <section className="mt-6" aria-labelledby="month-summary-changes">
              <h3
                id="month-summary-changes"
                className="text-sm font-semibold text-[var(--app-text)]"
              >
                {t("insights.summary.changesTitle", language).replace("{month}", previousMonth)}
              </h3>
              {summary.changes.length ? (
                <ul className="mt-2 grid gap-1">
                  {summary.changes.map((change) => (
                    <ChangeRow key={change.templateId} change={change} language={language} />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">
                  {t("insights.summary.noChanges", language).replace("{month}", previousMonth)}
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
}

function StatTile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="app-plan-metric-grid min-w-0 rounded-[var(--app-radius-md)] px-3 py-2.5">
      <dt className="text-xs font-medium text-[var(--app-text-muted)]">{label}</dt>
      <dd className="app-money mt-1 text-base font-semibold text-[var(--app-text)]">
        {formatCurrency(value)}
      </dd>
      <dd className="app-money mt-0.5 text-xs text-[var(--app-text-muted)]">{detail}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--app-radius-sm)] px-3 py-2">
      <dt className="text-sm font-medium text-[var(--app-text)]">{label}</dt>
      <dd className="app-money font-semibold text-[var(--app-text)]">{formatCurrency(value)}</dd>
    </div>
  );
}

function ChangeRow({ change, language }: { change: MonthSummaryChange; language: AppLanguage }) {
  const Icon = changeIcons[change.kind];
  const increase = change.delta > 0;

  return (
    <li className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--app-radius-sm)] px-1 py-1.5">
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] ${
            increase ? "text-[var(--app-warning)]" : "text-[var(--app-success)]"
          }`}
        >
          <Icon size={15} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block break-words text-sm font-semibold text-[var(--app-text)]">
            {change.name}
          </span>
          <span className="app-money block text-xs text-[var(--app-text-muted)]">
            {t(changeLabelKeys[change.kind], language)} · {formatCurrency(change.previousAmount)} →{" "}
            {formatCurrency(change.amount)}
          </span>
        </span>
      </span>
      <span className="app-money shrink-0 text-sm font-semibold text-[var(--app-text)]">
        {formatSignedCurrency(change.delta, formatCurrency)}
      </span>
    </li>
  );
}
