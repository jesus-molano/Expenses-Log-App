import type { Locale } from "date-fns";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import { t } from "@/shared/i18n";
import type { DropTarget } from "../../hooks/use-expense-dnd";
import type { TimelineSection } from "../../lib/timeline";
import { ExpenseRow } from "../ExpenseRow";
import { TimelineDayTargets } from "./TimelineDayTargets";

type TimelineNormalItemsProps = {
  section: TimelineSection;
  emptyDaysBefore: string[];
  emptyDaysAfter: string[];
  categories: ExpenseCategory[];
  today: string;
  language: AppLanguage;
  locale: Locale;
  activeOccurrence: ExpenseOccurrence | null;
  activeDropTarget: DropTarget | null;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
};

export function TimelineNormalItems({
  section,
  emptyDaysBefore,
  emptyDaysAfter,
  categories,
  today,
  language,
  locale,
  activeOccurrence,
  activeDropTarget,
  onTogglePaid,
}: TimelineNormalItemsProps) {
  if (!section.items.length) {
    return (
      <div className="app-empty-line px-3 py-3 text-sm font-medium">
        {t("expenses.todayEmpty", language)}
      </div>
    );
  }

  return (
    <>
      <TimelineDayTargets
        dates={emptyDaysBefore}
        activeDropTarget={activeDropTarget}
        locale={locale}
      />
      {section.items.map((occurrence) => (
        <ExpenseRow
          key={occurrence.id}
          occurrence={occurrence}
          category={categories.find(
            (category) => category.id === occurrence.template.categoryId,
          )}
          today={today}
          language={language}
          onTogglePaid={onTogglePaid}
          dropPosition={
            activeDropTarget?.rowId === occurrence.id
              ? activeDropTarget.position
              : null
          }
          dragging={activeOccurrence?.id === occurrence.id}
        />
      ))}
      <TimelineDayTargets
        dates={emptyDaysAfter}
        activeDropTarget={activeDropTarget}
        locale={locale}
      />
    </>
  );
}
