import { Pencil, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import { cn } from "@/shared/ui";

type QuickCaptureProps = {
  open: boolean;
  value: string;
  statusLabel: string;
  statusTone: "neutral" | "success" | "warning";
  isParsing: boolean;
  language: AppLanguage;
  onClose: () => void;
  onValueChange: (value: string) => void;
  onAnalyze: () => void;
  onManualAdd: () => void;
};

export function AddExpenseButton({
  language,
  visible,
  onClick,
}: {
  language: AppLanguage;
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={t("expenses.addExpense", language)}
      data-state={visible ? "visible" : "hidden"}
      onClick={onClick}
      className="app-fab"
    >
      <Plus size={24} strokeWidth={2.4} />
    </button>
  );
}

export function QuickCapture({
  open,
  value,
  statusLabel,
  statusTone,
  isParsing,
  language,
  onClose,
  onValueChange,
  onAnalyze,
  onManualAdd,
}: QuickCaptureProps) {
  if (!open) return null;

  return (
    <Sheet
      ariaLabel={t("expenses.addExpense", language)}
      onBackdropClick={onClose}
    >
      <section>
        <div className="app-sheet-header sticky top-0 z-10 px-5 pb-3 pt-3">
          <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">
                {t("expenses.addExpense", language)}
              </h2>
              <p className="truncate text-sm text-[var(--app-text-muted)]">
                {t("expenses.newExpenseSubtitle", language)}
              </p>
            </div>
            <IconButton
              type="button"
              onClick={onClose}
              aria-label={t("expenses.close", language)}
              className="shrink-0"
            >
              <X size={18} />
            </IconButton>
          </header>
        </div>

        <div className="grid gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            onClick={onManualAdd}
            className="w-full"
            variant="primary"
            size="lg"
            leadingIcon={<Pencil size={17} />}
          >
            {t("expenses.manual", language)}
          </Button>

          <details className="app-section-card group p-3">
            <summary className="app-focus-ring flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-[var(--app-radius-sm)] text-sm font-semibold text-[var(--app-text)]">
              <Sparkles size={17} className="text-[var(--app-accent)]" />
              {t("expenses.analyzeText", language)}
            </summary>
            <div className="mt-3">
              <label className="sr-only" htmlFor="quick-expense-text">
                {t("expenses.analyzeText", language)}
              </label>
              <input
                id="quick-expense-text"
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder={t("expenses.quickPlaceholder", language)}
                className="input-control w-full"
              />
              <Button
                type="button"
                onClick={onAnalyze}
                disabled={isParsing || !value.trim()}
                className="mt-3 w-full"
                variant="secondary"
                leadingIcon={<Sparkles size={17} />}
              >
                {isParsing
                  ? t("expenses.analyzing", language)
                  : t("expenses.analyzeText", language)}
              </Button>
              {statusLabel ? (
                <p
                  className={cn(
                    "mt-2 text-xs font-medium",
                    statusTone === "success" &&
                      "text-[color-mix(in_srgb,var(--app-success)_78%,var(--app-text))]",
                    statusTone === "warning" &&
                      "text-[color-mix(in_srgb,var(--app-warning)_78%,var(--app-text))]",
                    statusTone === "neutral" && "text-[var(--app-text-muted)]",
                  )}
                >
                  {statusLabel}
                </p>
              ) : null}
            </div>
          </details>
        </div>
      </section>
    </Sheet>
  );
}
