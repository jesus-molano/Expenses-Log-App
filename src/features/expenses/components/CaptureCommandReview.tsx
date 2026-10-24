"use client";

import { AlertTriangle, ArrowRightLeft, CheckCircle2, SkipForward, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { Sheet } from "@/components/ui/Sheet";
import type { CaptureCommand } from "@/domain/capture-commands";
import { foldText } from "@/domain/text";
import type { AppLanguage, ExpenseStore } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { ConfirmedCaptureCommand } from "@/stores/app/capture-command-actions";
import {
  useCaptureCommandReview,
  type CommandReviewItem,
} from "../hooks/use-capture-command-review";
import {
  commandDetailLabel,
  commandIntentLabel,
  commandIssueLabel,
} from "../lib/capture-command-labels";
import type { CaptureReason } from "../lib/capture-labels";
import { CaptureNotice } from "./CaptureNotice";
import { PaidAmountSuggestion } from "./PaidAmountSuggestion";

type CaptureCommandReviewProps = {
  commands: CaptureCommand[];
  // Altas de la misma captura, que se revisan después.
  pendingDrafts: number;
  store: ExpenseStore;
  today: string;
  monthId: string;
  notice: CaptureReason | null;
  language: AppLanguage;
  onApply: (commands: ConfirmedCaptureCommand[]) => void;
  onClose: () => void;
};

const INTENT_ICONS: Record<CaptureCommand["intent"], React.ReactNode> = {
  pay: <CheckCircle2 size={16} aria-hidden="true" />,
  skip: <SkipForward size={16} aria-hidden="true" />,
  move: <ArrowRightLeft size={16} aria-hidden="true" />,
};

// Confirmación de las órdenes dichas o escritas ("marca la luz pagada"):
// nada cambia hasta pulsar Aplicar.
export function CaptureCommandReview({
  commands,
  pendingDrafts,
  store,
  today,
  monthId,
  notice,
  language,
  onApply,
  onClose,
}: CaptureCommandReviewProps) {
  const review = useCaptureCommandReview({ commands, store, today, monthId, language });
  const count = review.confirmed.length;

  return (
    <Sheet ariaLabel={t("captureCommands.reviewTitle", language)} onBackdropClick={onClose}>
      <section>
        <div className="app-sheet-header sticky top-0 z-10 px-5 pb-3 pt-3">
          <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">
                {t("captureCommands.reviewTitle", language)}
              </h2>
              <p className="text-sm text-[var(--app-text-muted)]">
                {t("captureCommands.reviewSubtitle", language)}
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

        {notice ? (
          <div className="px-5 pb-2">
            <CaptureNotice reason={notice} language={language} />
          </div>
        ) : null}

        <ul className="grid gap-2 px-5">
          {review.items.map((item) => (
            <CommandCard
              key={item.id}
              item={item}
              store={store}
              monthId={monthId}
              language={language}
              onToggle={() => review.toggle(item.id)}
              onChooseTemplate={(templateId) => review.chooseTemplate(item.id, templateId)}
              onAmountChange={(value) => review.setAmountText(item.id, value)}
              onScopeChange={(scope) => review.setScope(item.id, scope)}
            />
          ))}
        </ul>

        <div className="grid gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {pendingDrafts > 0 ? (
            <p className="text-xs text-[var(--app-text-muted)]">
              {pendingDrafts === 1
                ? t("captureCommands.thenDraftsOne", language)
                : t("captureCommands.thenDrafts", language).replace(
                    "{count}",
                    String(pendingDrafts),
                  )}
            </p>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={count === 0}
            onClick={() => onApply(review.confirmed)}
          >
            {t("captureCommands.apply", language).replace("{count}", String(count))}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("captureCommands.cancel", language)}
          </Button>
        </div>
      </section>
    </Sheet>
  );
}

function CommandCard({
  item,
  store,
  monthId,
  language,
  onToggle,
  onChooseTemplate,
  onAmountChange,
  onScopeChange,
}: {
  item: CommandReviewItem;
  store: ExpenseStore;
  monthId: string;
  language: AppLanguage;
  onToggle: () => void;
  onChooseTemplate: (templateId: string) => void;
  onAmountChange: (value: string) => void;
  onScopeChange: (scope: CommandReviewItem["scope"]) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { resolved } = item;
  const { command } = resolved;
  const template = store.templates.find((candidate) => candidate.id === resolved.templateId);
  const title = `${commandIntentLabel(command.intent, language)}: ${template?.name ?? `«${command.target}»`}`;
  const checkboxId = `capture-command-${item.id}`;
  const needsChoice = resolved.issue === "notFound" || resolved.issue === "ambiguous";
  // Si el nombre no coincide del todo, se ofrece corregir la serie elegida.
  const canCorrect =
    Boolean(template) &&
    foldText(template?.name ?? "") !== foldText(command.target) &&
    resolved.candidates.length > 1;
  const detail = commandDetailLabel(resolved, language, item.amount);

  return (
    <li className="app-section-card app-section-card-open grid gap-2 p-3">
      <div className="flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-[var(--app-accent)]"
          checked={item.included}
          disabled={!item.applicable}
          onChange={onToggle}
          aria-label={t("captureCommands.include", language).replace("{label}", title)}
        />
        <label htmlFor={checkboxId} className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex items-start gap-1.5 text-sm font-semibold leading-snug text-[var(--app-text)]">
            <span className="mt-0.5 shrink-0 text-[var(--app-accent)]">{INTENT_ICONS[command.intent]}</span>
            <span className="min-w-0 break-words">{title}</span>
          </span>
          {detail ? <span className="text-xs text-[var(--app-text-muted)]">{detail}</span> : null}
        </label>
      </div>

      {resolved.issue ? (
        <p className="flex items-start gap-1.5 pl-8 text-xs font-semibold text-[color-mix(in_srgb,var(--app-warning)_78%,var(--app-text))]">
          <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {commandIssueLabel(resolved.issue, command, monthId, language)}
        </p>
      ) : null}

      {needsChoice || canCorrect ? (
        <div className="pl-8">
          <SelectMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            value={resolved.templateId ?? ""}
            align="left"
            label={template?.name ?? t("captureCommands.chooseExpense", language)}
            options={resolved.candidates.flatMap((templateId) => {
              const candidate = store.templates.find((entry) => entry.id === templateId);
              return candidate ? [{ value: templateId, label: candidate.name }] : [];
            })}
            keepOrder
            onChange={onChooseTemplate}
          />
        </div>
      ) : null}

      {/* Ya pagado con ese importe: cambiarlo corrige lo pagado. */}
      {command.intent === "pay" && resolved.occurrence ? (
        <div className="grid gap-2 pl-8">
          <label className="grid gap-1 text-xs font-semibold text-[var(--app-text-muted)]">
            {t("captureCommands.paidAmount", language)}
            <MoneyInput
              value={item.amountText}
              onValueChange={onAmountChange}
              invalidMessage={t("expenses.amountInvalid", language)}
              blockSubmit={false}
              className="h-10"
            />
          </label>
          {item.suggestion ? (
            <PaidAmountSuggestion
              suggestion={item.suggestion}
              language={language}
              onUse={onAmountChange}
            />
          ) : null}
        </div>
      ) : null}

      {command.intent === "move" && resolved.canMoveSeries && !resolved.issue ? (
        <div role="group" aria-label={t("captureCommands.intentMove", language)} className="grid grid-cols-2 gap-1.5 pl-8">
          {(["single", "series"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              aria-pressed={item.scope === scope}
              onClick={() => onScopeChange(scope)}
              className="app-control min-h-10 px-2 text-xs font-bold"
            >
              {t(scope === "single" ? "captureCommands.scopeOnlyThis" : "captureCommands.scopeSeries", language)}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
