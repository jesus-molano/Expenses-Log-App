import { CompactMenu } from "@/components/ui/CompactMenu";
import { formatCurrency } from "@/domain/calendar";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { MoneySeriesItem } from "../types";

type MonthlyComparisonSelectorsProps = {
  language: AppLanguage;
  moneySeries: MoneySeriesItem[];
  availableYears: number[];
  selectedYear: number;
  selectedMonthSummary: MoneySeriesItem;
  yearMenuOpen: boolean;
  monthMenuOpen: boolean;
  onYearOpenChange: (open: boolean) => void;
  onMonthOpenChange: (open: boolean) => void;
  onSelectYear: (year: number) => void;
  onSelectMonth: (monthId: string) => void;
};

export function MonthlyComparisonSelectors({
  language,
  moneySeries,
  availableYears,
  selectedYear,
  selectedMonthSummary,
  yearMenuOpen,
  monthMenuOpen,
  onYearOpenChange,
  onMonthOpenChange,
  onSelectYear,
  onSelectMonth,
}: MonthlyComparisonSelectorsProps) {
  return (
    <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-3">
      <SelectorField label={t("money.year", language)}>
        <CompactMenu
          open={yearMenuOpen}
          onOpenChange={onYearOpenChange}
          label={String(selectedYear)}
          align="left"
        >
          {availableYears.map((year) => (
            <SelectorOption
              key={year}
              selected={selectedYear === year}
              onClick={() => {
                onSelectYear(year);
                onYearOpenChange(false);
              }}
            >
              {year}
            </SelectorOption>
          ))}
        </CompactMenu>
      </SelectorField>

      <SelectorField label={t("money.month", language)}>
        <CompactMenu
          open={monthMenuOpen}
          onOpenChange={onMonthOpenChange}
          label={selectedMonthSummary.monthLong}
        >
          {moneySeries.length ? (
            moneySeries.map((item) => (
              <SelectorOption
                key={item.id}
                selected={selectedMonthSummary.id === item.id}
                onClick={() => {
                  onSelectMonth(item.id);
                  onMonthOpenChange(false);
                }}
              >
                <span className="truncate capitalize">{item.monthLong}</span>
                <span>{formatCurrency(item.remaining)}</span>
              </SelectorOption>
            ))
          ) : (
            <span className="px-3 py-2 text-sm text-[var(--app-text-muted)]">
              {t("money.noMonthsWithData", language)}
            </span>
          )}
        </CompactMenu>
      </SelectorField>
    </div>
  );
}

function SelectorField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1 text-xs font-semibold text-[var(--app-text-muted)]">
      {label}
      {children}
    </div>
  );
}

function SelectorOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="app-select-menu-option flex h-9 w-full items-center justify-between gap-3 rounded-[var(--app-radius-sm)] px-3 text-left text-sm font-semibold"
      data-selected={selected ? "true" : "false"}
    >
      {children}
    </button>
  );
}
