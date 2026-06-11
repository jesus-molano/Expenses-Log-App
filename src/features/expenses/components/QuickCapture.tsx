"use client";

import { Pencil, Plus, Sparkles, X } from "lucide-react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type QuickCaptureProps = {
  open: boolean;
  value: string;
  statusLabel: string;
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
      aria-label={language === "en" ? "Add expense" : "Añadir gasto"}
      data-state={visible ? "visible" : "hidden"}
      onClick={onClick}
      className="fixed bottom-[calc(5.65rem+env(safe-area-inset-bottom))] right-4 z-30 grid size-13 place-items-center rounded-full bg-[var(--app-accent)] text-[var(--app-accent-contrast)] shadow-[0_16px_38px_color-mix(in_srgb,var(--app-accent)_22%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--app-accent)_32%,transparent)] transition-[opacity,transform,background-color] duration-300 hover:bg-[var(--app-accent-hover)] sm:right-[calc(50%-14rem)] data-[state=hidden]:pointer-events-none data-[state=hidden]:translate-y-3 data-[state=hidden]:scale-90 data-[state=hidden]:opacity-0"
    >
      <Plus size={24} strokeWidth={2.4} />
    </button>
  );
}

export function QuickCapture({
  open,
  value,
  statusLabel,
  isParsing,
  language,
  onClose,
  onValueChange,
  onAnalyze,
  onManualAdd,
}: QuickCaptureProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[var(--app-backdrop)] p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.65rem] border border-[var(--app-border)] bg-[var(--app-surface-strong)] shadow-[var(--app-shadow)] sm:max-w-xl sm:rounded-[1.65rem]">
        <div className="sticky top-0 z-10 bg-[color-mix(in_srgb,var(--app-surface-strong)_92%,transparent)] px-5 pb-3 pt-3 backdrop-blur-xl">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">
                {language === "en" ? "Add expense" : "Añadir gasto"}
              </h2>
              <p className="truncate text-sm text-[var(--app-text-muted)]">
                {t("expenses.newExpenseSubtitle", language)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("expenses.close", language)}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)] transition hover:text-[var(--app-text)]"
            >
              <X size={18} />
            </button>
          </header>
        </div>

        <div className="grid gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="rounded-[1.15rem] border border-[var(--app-border)] bg-[var(--app-panel-soft-alpha)] p-3">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
              <Sparkles size={17} className="text-[var(--app-accent)]" />
              {t("expenses.analyzeText", language)}
            </label>
            <input
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder={t("expenses.quickPlaceholder", language)}
              className="input-control w-full"
            />
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isParsing || !value.trim()}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--app-accent)] px-4 text-sm font-semibold text-[var(--app-accent-contrast)] transition hover:bg-[var(--app-accent-hover)] disabled:bg-[var(--app-panel-soft-alpha)] disabled:text-[var(--app-text-subtle)]"
            >
              <Sparkles size={17} />
              {isParsing
                ? t("expenses.analyzing", language)
                : t("expenses.analyzeText", language)}
            </button>
            {statusLabel ? (
              <p className="mt-2 text-xs text-[var(--app-text-muted)]">
                {statusLabel}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onManualAdd}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--app-panel-soft-alpha)] px-4 text-sm font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)] transition hover:bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]"
          >
            <Pencil size={17} />
            {t("expenses.manual", language)}
          </button>
        </div>
      </section>
    </div>
  );
}
