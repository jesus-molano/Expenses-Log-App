"use client";

import { CheckCircle2, Circle, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { OfflineLink } from "@/components/ui/OfflineLink";
import type { AppLanguage } from "@/domain/types";
import { t, type TranslationKey } from "@/shared/i18n";
import { cn } from "@/shared/ui";
import type {
  OnboardingChecklist,
  OnboardingStepId,
  QuickAddPreset,
} from "../../lib/onboarding";

type OnboardingCardProps = {
  checklist: OnboardingChecklist;
  quickAdds: QuickAddPreset[];
  canPromptInstall: boolean;
  appleMobile: boolean;
  language: AppLanguage;
  onQuickAdd: (preset: QuickAddPreset) => void;
  onAddExpense: () => void;
  onConfigureSalary: () => void;
  onInstall: () => void;
  onDismiss: () => void;
};

const STEP_COPY: Record<OnboardingStepId, { title: TranslationKey; help: TranslationKey }> = {
  expense: { title: "onboarding.stepExpense", help: "onboarding.stepExpenseHelp" },
  salary: { title: "onboarding.stepSalary", help: "onboarding.stepSalaryHelp" },
  notifications: { title: "onboarding.stepNotifications", help: "onboarding.stepNotificationsHelp" },
  install: { title: "onboarding.stepInstall", help: "onboarding.stepInstallHelp" },
};

// Primeros pasos con la app vacía: alta rápida de los gastos fijos típicos y
// una lista de lo que conviene configurar.
export function OnboardingCard({
  checklist,
  quickAdds,
  canPromptInstall,
  appleMobile,
  language,
  onQuickAdd,
  onAddExpense,
  onConfigureSalary,
  onInstall,
  onDismiss,
}: OnboardingCardProps) {
  const [installHelpOpen, setInstallHelpOpen] = useState(false);

  function stepAction(id: OnboardingStepId) {
    if (id === "expense") {
      return (
        <Button type="button" size="sm" variant="secondary" onClick={onAddExpense}>
          {t("onboarding.actionExpense", language)}
        </Button>
      );
    }
    if (id === "salary") {
      return (
        <Button type="button" size="sm" variant="secondary" onClick={onConfigureSalary}>
          {t("onboarding.actionSalary", language)}
        </Button>
      );
    }
    if (id === "notifications") {
      return (
        <OfflineLink
          href="/settings?from=expenses"
          className="app-button app-button-secondary app-button-sm"
        >
          {t("onboarding.actionNotifications", language)}
        </OfflineLink>
      );
    }
    return canPromptInstall ? (
      <Button type="button" size="sm" variant="secondary" onClick={onInstall}>
        {t("onboarding.actionInstall", language)}
      </Button>
    ) : (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-expanded={installHelpOpen}
        onClick={() => setInstallHelpOpen((open) => !open)}
      >
        {t("onboarding.actionHow", language)}
      </Button>
    );
  }

  return (
    <section aria-labelledby="onboarding-title" className="app-section-card grid gap-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="onboarding-title"
            className="flex items-center gap-2 text-base font-semibold text-[var(--app-text)]"
          >
            <Sparkles size={18} aria-hidden="true" className="shrink-0 text-[var(--app-accent)]" />
            {t("onboarding.title", language)}
          </h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            {t("onboarding.subtitle", language)}
          </p>
        </div>
        <IconButton
          type="button"
          variant="ghost"
          onClick={onDismiss}
          aria-label={t("onboarding.dismiss", language)}
          className="shrink-0"
        >
          <X size={18} />
        </IconButton>
      </header>

      {quickAdds.length ? (
        <div
          role="group"
          aria-label={t("onboarding.quickAdd", language)}
          className="flex flex-wrap gap-2"
        >
          {quickAdds.map((preset) => {
            const name = t(preset.labelKey, language);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onQuickAdd(preset)}
                aria-label={t("onboarding.quickAddItem", language).replace("{name}", name)}
                className="app-chip app-focus-ring inline-flex min-h-9 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
              >
                <Plus size={14} aria-hidden="true" />
                {name}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--app-text)]">
            {t("onboarding.checklistTitle", language)}
          </h3>
          <span className="text-xs font-semibold text-[var(--app-text-muted)]">
            {t("onboarding.progress", language)
              .replace("{done}", String(checklist.doneCount))
              .replace("{total}", String(checklist.total))}
          </span>
        </div>
        <ul className="grid gap-2">
          {checklist.steps.map((step) => (
            <li
              key={step.id}
              className="app-list-item grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2"
              data-done={step.done ? "true" : "false"}
            >
              {step.done ? (
                <CheckCircle2 size={18} aria-hidden="true" className="text-[var(--app-success)]" />
              ) : (
                <Circle size={18} aria-hidden="true" className="text-[var(--app-text-subtle)]" />
              )}
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    step.done ? "text-[var(--app-text-muted)] line-through" : "text-[var(--app-text)]",
                  )}
                >
                  {t(STEP_COPY[step.id].title, language)}
                  {step.done ? (
                    <span className="sr-only"> · {t("onboarding.done", language)}</span>
                  ) : null}
                </span>
                <span
                  aria-live={step.id === "install" ? "polite" : undefined}
                  className="block text-xs text-[var(--app-text-muted)]"
                >
                  {step.id === "install" && installHelpOpen && !step.done
                    ? t(appleMobile ? "onboarding.installIos" : "onboarding.installManual", language)
                    : t(STEP_COPY[step.id].help, language)}
                </span>
              </span>
              {step.done ? null : <span className="shrink-0">{stepAction(step.id)}</span>}
            </li>
          ))}
        </ul>
        {checklist.complete ? (
          <p role="status" className="text-sm font-semibold text-[var(--app-success)]">
            {t("onboarding.allDone", language)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
