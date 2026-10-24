"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Surface } from "@/components/ui/Surface";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { formatMonthName } from "@/features/expenses/lib/month-view";
import { formatMessage, t } from "@/shared/i18n";
import { cn } from "@/shared/ui";
import {
  accountDisplayName,
  accountRoleChipClass,
  accountRoleLabel,
} from "../lib/account-labels";
import type { AccountInsight, AccountSummary } from "../lib/account-summary";
import type { BalanceEntry } from "../lib/balance-log";
import { formatShortDate } from "../lib/plan-dashboard";
import { BalanceHistory, BalanceTrendLine } from "./BalanceHistory";

// Una cuenta: su último saldo, lo que toca según su papel y su historial.
export function AccountCard({
  summary,
  insight,
  monthId,
  language,
  canMoveUp,
  canMoveDown,
  showReorder,
  onRecord,
  onEdit,
  onMove,
  onDeleteEntry,
}: {
  summary: AccountSummary;
  insight: AccountInsight;
  // Mes activo, para el objetivo de ahorro.
  monthId: string;
  language: AppLanguage;
  canMoveUp: boolean;
  canMoveDown: boolean;
  showReorder: boolean;
  onRecord: () => void;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  onDeleteEntry: (entry: BalanceEntry) => void;
}) {
  const titleId = useId();
  const historyId = useId();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { account, entries, trend } = summary;
  const name = accountDisplayName(account, language);
  const label = (key: "insights.accounts.moveUp" | "insights.accounts.moveDown" | "insights.accounts.edit") =>
    formatMessage(key, { name }, language);

  return (
    <Surface
      as="article"
      variant="muted"
      padding="sm"
      aria-labelledby={titleId}
      className="grid min-w-0 gap-3"
    >
      <header className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1 pt-1">
          <h3
            id={titleId}
            className="break-words text-base font-semibold leading-snug text-[var(--app-text)]"
          >
            {name}
          </h3>
          <span
            className={cn(
              "app-chip mt-1 inline-flex px-2 py-0.5 text-xs font-semibold",
              accountRoleChipClass(account.role),
            )}
          >
            {accountRoleLabel(account.role, language)}
          </span>
        </div>
        <div className="flex shrink-0 items-center">
          {showReorder ? (
            <>
              <IconButton
                variant="ghost"
                size="touch"
                disabled={!canMoveUp}
                onClick={() => onMove(-1)}
                aria-label={label("insights.accounts.moveUp")}
              >
                <ChevronUp size={18} aria-hidden="true" />
              </IconButton>
              <IconButton
                variant="ghost"
                size="touch"
                disabled={!canMoveDown}
                onClick={() => onMove(1)}
                aria-label={label("insights.accounts.moveDown")}
              >
                <ChevronDown size={18} aria-hidden="true" />
              </IconButton>
            </>
          ) : null}
          <IconButton
            variant="ghost"
            size="touch"
            onClick={onEdit}
            aria-label={label("insights.accounts.edit")}
          >
            <Pencil size={16} aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      <div className="min-w-0">
        {trend ? (
          <>
            <p className="text-xs font-medium text-[var(--app-text-muted)]">
              {t("insights.balance.latest", language).replace(
                "{date}",
                formatShortDate(trend.latest.date, language),
              )}
            </p>
            <p className="app-money mt-1 break-words text-2xl font-semibold text-[var(--app-text)]">
              {formatCurrency(trend.latest.amount)}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--app-text-muted)]">
            {t("insights.balance.empty", language)}
          </p>
        )}
        {insight.savingsTarget !== null ? (
          <p className="app-money mt-1 break-words text-xs text-[var(--app-text-muted)]">
            {formatMessage(
              "insights.accounts.savingsTarget",
              {
                month: formatMonthName(monthId, language),
                amount: formatCurrency(insight.savingsTarget),
              },
              language,
            )}
          </p>
        ) : null}
        {insight.change ? <BalanceTrendLine trend={insight.change} language={language} /> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="soft"
          leadingIcon={<Plus size={16} aria-hidden="true" />}
          onClick={onRecord}
          aria-label={formatMessage("insights.accounts.record", { name }, language)}
        >
          {t("insights.balance.record", language)}
        </Button>
        {entries.length ? (
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={historyOpen}
            aria-controls={historyId}
            trailingIcon={
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={cn("transition-transform", historyOpen && "rotate-180")}
              />
            }
            onClick={() => setHistoryOpen((open) => !open)}
          >
            {t(
              historyOpen ? "insights.accounts.hideHistory" : "insights.accounts.showHistory",
              language,
            )}
          </Button>
        ) : null}
      </div>

      {historyOpen && entries.length ? (
        <div id={historyId}>
          <BalanceHistory language={language} entries={entries} onDelete={onDeleteEntry} />
        </div>
      ) : null}
    </Surface>
  );
}
