import { CalendarClock, CreditCard, ExternalLink } from "lucide-react";
import { commitmentStatus } from "@/domain/expense-details";
import type { AppLanguage, ExpenseTemplate } from "@/domain/types";
import { t } from "@/shared/i18n";
import { cn } from "@/shared/ui";
import { commitmentLabel, paymentMethodLabel } from "../lib/expense-detail-labels";

type ExpenseContractSummaryProps = {
  template: ExpenseTemplate;
  today: string;
  language: AppLanguage;
};

// Lo guardado del contrato, a mano en el detalle: cuándo acaba la
// permanencia, cómo se paga y el enlace para darse de baja.
export function ExpenseContractSummary({ template, today, language }: ExpenseContractSummaryProps) {
  const commitment = commitmentStatus(template.commitmentEndDate, today);
  const payment = paymentMethodLabel(template.paymentMethod, template.paymentMethodDetail, language);
  if (!commitment && !payment && !template.cancellationUrl) return null;

  return (
    <section
      aria-label={t("expenseDetails.summaryTitle", language)}
      className="app-inline-panel mt-4 grid gap-2 p-3 text-sm"
    >
      {commitment ? (
        <p
          className={cn(
            "flex items-start gap-2 font-semibold",
            commitment.kind === "ending" && "text-[var(--app-warning)]",
            commitment.kind === "ended" && "text-[var(--app-success)]",
            commitment.kind === "active" && "text-[var(--app-text-muted)]",
          )}
        >
          <CalendarClock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          {commitmentLabel(commitment, language)}
        </p>
      ) : null}
      {payment ? (
        <p className="flex items-start gap-2 font-medium text-[var(--app-text-muted)]">
          <CreditCard size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          {payment}
        </p>
      ) : null}
      {template.cancellationUrl ? (
        <a
          href={template.cancellationUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("expenseDetails.openCancellationLabel", language).replace(
            "{name}",
            template.name,
          )}
          className="app-button app-button-secondary app-button-sm w-fit"
        >
          <ExternalLink size={15} aria-hidden="true" />
          {t("expenseDetails.openCancellation", language)}
        </a>
      ) : null}
    </section>
  );
}
