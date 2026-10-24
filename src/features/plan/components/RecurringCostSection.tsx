"use client";

import { ChevronDown, WalletCards } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { categoryIconMap } from "@/features/expenses/lib/expense-form-options";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";
import { formatPercent } from "../lib/insight-format";
import type { CategoryCost, RecurringCostInsights } from "../lib/recurring-costs";
import { PlanEmptyLine } from "./PlanSectionList";

// Vista anual de lo recurrente: cuánto se va al mes y al año en cada
// categoría y, al abrir una, en cada gasto.
export function RecurringCostSection({
  language,
  insights,
}: {
  language: AppLanguage;
  insights: RecurringCostInsights;
}) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  return (
    <section className="min-w-0" aria-labelledby="category-cost-title">
      <header className="px-1">
        <h2 id="category-cost-title" className="app-plan-section-title text-[var(--app-text)]">
          {t("insights.cost.title", language)}
        </h2>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          {t("insights.cost.subtitle", language)}
        </p>
      </header>

      {insights.categories.length ? (
        <>
          <dl className="app-plan-metric-grid mt-4 grid grid-cols-2 gap-x-5 rounded-[var(--app-radius-lg)] px-3 py-3">
            <Metric
              label={t("insights.cost.monthlyAverage", language)}
              value={insights.monthlyAverage}
            />
            <Metric
              label={t("insights.cost.windowTotal", language)}
              value={insights.annualTotal}
            />
          </dl>
          {insights.salaryShare !== null ? (
            <p className="mt-2 px-1 text-xs text-[var(--app-text-muted)]">
              {t("insights.cost.salaryShare", language).replace(
                "{percent}",
                formatPercent(insights.salaryShare, language),
              )}
            </p>
          ) : null}
          <ul className="mt-4 grid gap-1">
            {insights.categories.map((category) => (
              <CategoryRow
                key={category.categoryId}
                category={category}
                language={language}
                open={openCategoryId === category.categoryId}
                onToggle={() =>
                  setOpenCategoryId((current) =>
                    current === category.categoryId ? null : category.categoryId,
                  )
                }
              />
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-4">
          <PlanEmptyLine>{t("insights.cost.empty", language)}</PlanEmptyLine>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 py-1.5">
      <dt className="text-xs font-medium text-[var(--app-text-muted)]">{label}</dt>
      <dd className="app-money mt-1 text-base font-semibold text-[var(--app-text)]">
        {formatCurrency(value)}
      </dd>
    </div>
  );
}

function CategoryRow({
  category,
  language,
  open,
  onToggle,
}: {
  category: CategoryCost;
  language: AppLanguage;
  open: boolean;
  onToggle: () => void;
}) {
  const name = categoryLabel(category.category?.name ?? "General", language);
  const Icon = categoryIconMap[category.category?.icon ?? ""] ?? WalletCards;
  const listId = `category-cost-${category.categoryId}`;

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className="app-plan-action-row app-focus-ring grid w-full min-w-0 gap-2 rounded-[var(--app-radius-md)] px-3 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="app-monthly-category-menu-icon" data-tone={category.category?.tone ?? "slate"}>
            <Icon size={14} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 break-words text-sm font-semibold text-[var(--app-text)]">
            {name}
          </span>
          <span className="app-money shrink-0 text-sm font-semibold text-[var(--app-text)]">
            {t("insights.cost.perMonth", language).replace(
              "{amount}",
              formatCurrency(category.monthly),
            )}
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`shrink-0 text-[var(--app-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
        <span
          className="block h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-accent)_16%,transparent)]"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full bg-[var(--app-accent)]"
            style={{ width: `${Math.max(category.share * 100, 2)}%` }}
          />
        </span>
        <span className="app-money block text-xs text-[var(--app-text-muted)]">
          {t("insights.cost.perYear", language).replace("{amount}", formatCurrency(category.annual))}{" "}
          · {t("insights.cost.share", language).replace("{percent}", formatPercent(category.share, language))}
        </span>
      </button>
      {open ? (
        <ul id={listId} className="mb-2 ml-12 grid gap-1 border-l border-[var(--app-border)] pl-3">
          {category.expenses.map((expense) => (
            <li
              key={expense.templateId}
              className="flex min-h-11 items-center justify-between gap-3 py-1.5"
            >
              <span className="min-w-0">
                <span className="block break-words text-sm font-medium text-[var(--app-text)]">
                  {expense.name}
                </span>
                <span className="app-money block text-xs text-[var(--app-text-muted)]">
                  {t("insights.cost.perMonth", language).replace(
                    "{amount}",
                    formatCurrency(expense.monthly),
                  )}{" "}
                  ·{" "}
                  {expense.charges === 1
                    ? t("insights.cost.chargesOne", language)
                    : t("insights.cost.chargesMany", language).replace(
                        "{count}",
                        String(expense.charges),
                      )}
                </span>
              </span>
              <span className="app-money shrink-0 text-sm font-semibold text-[var(--app-text)]">
                {t("insights.cost.perYear", language).replace(
                  "{amount}",
                  formatCurrency(expense.annual),
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
