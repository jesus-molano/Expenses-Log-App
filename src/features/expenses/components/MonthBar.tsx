"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { capitalize, formatMonthName } from "../lib/month-view";

type MonthBarProps = {
  monthId: string;
  activeMonthId: string;
  calendarMonthId: string;
  language: AppLanguage;
  canBrowseBack: boolean;
  canBrowseForward: boolean;
  onBrowse: (delta: number) => void;
  onReset: () => void;
  onReopen: () => void;
  // Destino del foco cuando desaparece o se desactiva el botón usado.
  headingRef: RefObject<HTMLHeadingElement | null>;
};

// Selector del mes que se mira. Debajo ofrece volver al mes activo, o al
// natural cuando el activo es el siguiente.
export function MonthBar({
  monthId,
  activeMonthId,
  calendarMonthId,
  language,
  canBrowseBack,
  canBrowseForward,
  onBrowse,
  onReset,
  onReopen,
  headingRef,
}: MonthBarProps) {
  const name = (id: string) => formatMonthName(id, language);
  const backRef = useRef<HTMLButtonElement>(null);
  const forwardRef = useRef<HTMLButtonElement>(null);

  // Al llegar al límite el botón pulsado se desactiva y perdería el foco.
  useEffect(() => {
    const active = document.activeElement;
    if (
      (active === backRef.current && !canBrowseBack) ||
      (active === forwardRef.current && !canBrowseForward)
    ) {
      headingRef.current?.focus();
    }
  }, [canBrowseBack, canBrowseForward, headingRef]);

  return (
    <nav
      aria-label={t("expenses.monthNavigation", language)}
      className="flex items-center justify-between gap-2"
    >
      <IconButton
        ref={backRef}
        variant="ghost"
        onClick={() => onBrowse(-1)}
        disabled={!canBrowseBack}
        aria-label={t("expenses.previousMonth", language)}
      >
        <ChevronLeft size={18} />
      </IconButton>

      <div className="grid min-w-0 justify-items-center gap-0.5 text-center">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="app-focus-ring rounded-[var(--app-radius-sm)] text-base font-semibold text-[var(--app-text)]"
          aria-live="polite"
        >
          {capitalize(formatMonthName(monthId, language, { withYear: true }))}
        </h2>
        {monthId !== activeMonthId ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            {t("expenses.goToMonth", language).replace("{month}", name(activeMonthId))}
          </Button>
        ) : activeMonthId !== calendarMonthId ? (
          <p className="flex flex-wrap items-center justify-center gap-x-1 text-xs text-[var(--app-text-muted)]">
            {capitalize(
              t("expenses.monthActive", language).replace("{month}", name(activeMonthId)),
            )}
            <span aria-hidden="true">·</span>
            <Button variant="ghost" size="sm" onClick={onReopen}>
              {t("expenses.backToMonth", language).replace(
                "{month}",
                name(calendarMonthId),
              )}
            </Button>
          </p>
        ) : null}
      </div>

      <IconButton
        ref={forwardRef}
        variant="ghost"
        onClick={() => onBrowse(1)}
        disabled={!canBrowseForward}
        aria-label={t("expenses.nextMonth", language)}
      >
        <ChevronRight size={18} />
      </IconButton>
    </nav>
  );
}
