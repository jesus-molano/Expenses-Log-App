import type { Locale } from "date-fns";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import type { DropTarget } from "../../hooks/use-expense-dnd";
import { groupMonthItemsByDate } from "../../lib/timeline-expanded-month";
import type { TimelineSection } from "../../lib/timeline";
import { TimelineDayGroup } from "./TimelineDayGroup";

type TimelineExpandedMonthProps = {
  dates: string[];
  allSections: TimelineSection[];
  categories: ExpenseCategory[];
  today: string;
  language: AppLanguage;
  locale: Locale;
  activeOccurrence: ExpenseOccurrence | null;
  activeDropTarget: DropTarget | null;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
};

export function TimelineExpandedMonth({
  dates,
  allSections,
  categories,
  today,
  language,
  locale,
  activeOccurrence,
  activeDropTarget,
  onTogglePaid,
}: TimelineExpandedMonthProps) {
  const itemsByDate = groupMonthItemsByDate(allSections, dates[0]);

  return dates.map((day) => (
    <TimelineDayGroup
      key={day}
      day={day}
      items={itemsByDate.get(day) ?? []}
      categories={categories}
      today={today}
      language={language}
      locale={locale}
      activeOccurrence={activeOccurrence}
      activeDropTarget={activeDropTarget}
      onTogglePaid={onTogglePaid}
    />
  ));
}
