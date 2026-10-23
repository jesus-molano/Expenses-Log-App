"use client";

import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Check, Forward, Undo2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/domain/calendar";
import { isOccurrenceOverdue } from "@/domain/pending";
import type { AppLanguage, ExpenseCategory } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";
import type { LeftoverRow } from "../../lib/month-close";

type MonthCloseLeftoverRowProps = {
  row: LeftoverRow;
  nextMonthName: string;
  categories: ExpenseCategory[];
  today: string;
  language: AppLanguage;
  onPay: () => void;
  onSkip: () => void;
  onMove: () => void;
  onUndo: () => void;
};

// Un recibo que queda del mes: Pagado, Saltar o Mover al mes siguiente. Una
// vez resuelto muestra qué se hizo y permite deshacerlo.
export function MonthCloseLeftoverRow({
  row,
  nextMonthName,
  categories,
  today,
  language,
  onPay,
  onSkip,
  onMove,
  onUndo,
}: MonthCloseLeftoverRowProps) {
  const { occurrence, resolution } = row;
  const name = occurrence.template.name;
  const rowRef = useRef<HTMLLIElement>(null);
  const previousResolution = useRef(resolution);
  const category = categories.find((item) => item.id === occurrence.template.categoryId);
  const status = isOccurrenceOverdue(occurrence, today)
    ? t("expenses.overdue", language)
    : t("common.pending", language);
  const resolvedLabel = {
    pending: "",
    paid: t("monthClose.resolvedPaid", language),
    skipped: t("monthClose.resolvedSkipped", language),
    moved: t("monthClose.resolvedMoved", language).replace("{month}", nextMonthName),
  }[resolution];

  // El botón usado desaparece al resolver o deshacer: el foco pasa al primer
  // control nuevo de la fila para no perderse.
  useEffect(() => {
    if (previousResolution.current === resolution) return;
    previousResolution.current = resolution;
    const active = document.activeElement;
    if (!active || active === document.body || rowRef.current?.contains(active)) {
      rowRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [resolution]);

  return (
    <li
      ref={rowRef}
      className="app-section-card grid min-w-0 gap-2.5 p-3"
      data-leftover-row="true"
      data-resolution={resolution}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-semibold ${
              resolution === "pending"
                ? "text-[var(--app-text)]"
                : "text-[var(--app-text-subtle)] line-through"
            }`}
          >
            {name}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--app-text-muted)]">
            {[
              format(parseISO(occurrence.dueDate), "d MMM", {
                locale: language === "en" ? enUS : es,
              }),
              category ? categoryLabel(category.name, language) : null,
              resolution === "pending" ? status : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <p className="app-money shrink-0 text-sm font-semibold text-[var(--app-text)]">
          {formatCurrency(occurrence.template.amount)}
        </p>
      </div>

      {resolution === "pending" ? (
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="soft"
            className="min-w-0 px-2"
            leadingIcon={<Check size={14} aria-hidden="true" />}
            aria-label={t("monthClose.payLabel", language).replace("{name}", name)}
            onClick={onPay}
          >
            {t("monthClose.pay", language)}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-w-0 px-2"
            leadingIcon={<X size={14} aria-hidden="true" />}
            aria-label={t("monthClose.skipLabel", language).replace("{name}", name)}
            onClick={onSkip}
          >
            {t("monthClose.skip", language)}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-w-0 px-2"
            leadingIcon={<Forward size={14} aria-hidden="true" />}
            aria-label={t("monthClose.moveLabel", language)
              .replace("{month}", nextMonthName)
              .replace("{name}", name)}
            onClick={onMove}
          >
            {t("monthClose.move", language)}
          </Button>
        </div>
      ) : (
        <div className="flex min-h-9 items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--app-success)]">{resolvedLabel}</p>
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Undo2 size={14} aria-hidden="true" />}
            aria-label={t("monthClose.undoLabel", language).replace(
              "{name}",
              `${name} · ${resolvedLabel}`,
            )}
            onClick={onUndo}
          >
            {t("common.undo", language)}
          </Button>
        </div>
      )}
    </li>
  );
}
