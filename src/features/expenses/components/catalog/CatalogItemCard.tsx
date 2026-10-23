import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, WalletCards } from "lucide-react";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage, ExpenseCategory } from "@/domain/types";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";
import { categoryToneClass } from "../../lib/expense-actions";
import type { CatalogItem } from "../../lib/expense-catalog";
import { paymentMethodLabel } from "../../lib/expense-detail-labels";
import { categoryIconMap } from "../../lib/expense-form-options";
import { localizedRecurrenceLabel } from "../../lib/recurrence-label";
import { formatRecurringDate } from "../../lib/recurring-overview-format";

type CatalogItemCardProps = {
  item: CatalogItem;
  category?: ExpenseCategory;
  language: AppLanguage;
};

// Una serie del catálogo: abre su detalle para editarla.
export function CatalogItemCard({ item, category, language }: CatalogItemCardProps) {
  const { template } = item;
  const Icon = categoryIconMap[category?.icon ?? ""] ?? WalletCards;
  const payment = paymentMethodLabel(template.paymentMethod, template.paymentMethodDetail, language);
  const subtitle = [
    localizedRecurrenceLabel(template.recurrence, language),
    category ? categoryLabel(category.name, language) : null,
    payment || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link
        href={`/expenses/${template.id}`}
        className="app-list-item app-focus-ring grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5"
        data-finished={item.finished ? "true" : "false"}
      >
        <span
          className={`${categoryToneClass(category?.tone ?? "slate")} grid size-9 place-items-center rounded-full`}
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>
        <span className="min-w-0">
          <span
            className={`block break-words text-sm font-semibold leading-snug ${
              item.finished ? "text-[var(--app-text-muted)]" : "text-[var(--app-text)]"
            }`}
          >
            {template.name}
          </span>
          <span className="block break-words text-xs font-medium text-[var(--app-text-muted)]">
            {subtitle}
          </span>
          <CatalogItemStatus item={item} language={language} />
        </span>
        <span className="shrink-0 text-right">
          <span className="app-money block text-sm font-semibold text-[var(--app-text)]">
            {formatCurrency(template.amount)}
          </span>
          {item.yearlyCost > 0 && template.recurrence.frequency !== "once" ? (
            <span className="app-money block text-[11px] font-medium text-[var(--app-text-muted)]">
              {t("catalog.perYear", language).replace("{amount}", formatCurrency(item.yearlyCost))}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

function CatalogItemStatus({ item, language }: { item: CatalogItem; language: AppLanguage }) {
  const date = (value: string) => formatRecurringDate(value, language);
  const status = item.finished
    ? {
        icon: <CheckCircle2 size={12} aria-hidden="true" />,
        text: item.finishedOn
          ? t("catalog.finishedOn", language).replace("{date}", date(item.finishedOn))
          : t("catalog.finished", language),
        className: "text-[var(--app-text-muted)]",
      }
    : item.overdueOccurrence
      ? {
          icon: <AlertTriangle size={12} aria-hidden="true" />,
          text: t("catalog.overdue", language).replace(
            "{date}",
            date(item.overdueOccurrence.dueDate),
          ),
          className: "text-[var(--app-danger)]",
        }
      : {
          icon: null,
          text: item.nextOccurrence
            ? t("catalog.nextCharge", language).replace(
                "{date}",
                date(item.nextOccurrence.dueDate),
              )
            : t("catalog.noUpcoming", language),
          className: "text-[var(--app-text-muted)]",
        };
  const commitmentEnding = !item.finished && item.commitment?.kind === "ending";

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold">
      <span className={`inline-flex items-center gap-1 ${status.className}`}>
        {status.icon}
        {status.text}
      </span>
      {commitmentEnding && item.commitment ? (
        <span className="app-chip app-chip-orange inline-flex items-center gap-1 px-2 py-0.5">
          <CalendarClock size={12} aria-hidden="true" />
          {t("expenseDetails.commitmentShort", language).replace(
            "{days}",
            String(item.commitment.daysLeft),
          )}
        </span>
      ) : null}
    </span>
  );
}
