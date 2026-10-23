"use client";

import { useId } from "react";
import { BellRing, Share, Smartphone, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { AppLanguage } from "@/domain/types";
import { t, type TranslationKey } from "@/shared/i18n";
import type { InstallGuide } from "../../lib/install-guide";

type IosInstallSheetProps = {
  guide: InstallGuide;
  language: AppLanguage;
  onClose: () => void;
};

export function IosInstallSheet({ guide, language, onClose }: IosInstallSheetProps) {
  const titleId = useId();
  const steps: Array<{ icon: React.ReactNode; text: TranslationKey }> = [
    {
      icon: <Share size={18} />,
      text: guide === "ios-safari" ? "reminders.installStepShare" : "reminders.installStepShareOther",
    },
    { icon: <SquarePlus size={18} />, text: "reminders.installStepAdd" },
    { icon: <Smartphone size={18} />, text: "reminders.installStepOpen" },
    { icon: <BellRing size={18} />, text: "reminders.installStepNotify" },
  ];

  return (
    <Sheet ariaLabelledBy={titleId} onBackdropClick={onClose}>
      <div className="p-5">
        <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-[var(--app-text)]">
              {t("reminders.installSheetTitle", language)}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--app-text-muted)]">
              {t("reminders.installSheetSubtitle", language)}
            </p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-full"
          >
            {t("common.close", language)}
          </Button>
        </header>

        <ol className="mt-5 grid gap-2">
          {steps.map((step, index) => (
            <li
              key={step.text}
              className="app-list-item flex items-center gap-3 px-3 py-3"
            >
              <span className="app-icon-badge size-9 min-h-9 min-w-9 shrink-0 text-[var(--app-accent)]">
                {step.icon}
              </span>
              <span className="min-w-0 text-sm leading-relaxed text-[var(--app-text)]">
                <span className="sr-only">{index + 1}. </span>
                {t(step.text, language)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Sheet>
  );
}
