import type { Locale } from "date-fns";
import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import type { DropTarget } from "../../hooks/use-expense-dnd";
import { ExpenseRow } from "../ExpenseRow";
import { TimelineEmptyDayTarget } from "../TimelineEmptyDayTarget";

type TimelineDayGroupProps = {
  day: string;
  items: ExpenseOccurrence[];
  categories: ExpenseCategory[];
  today: string;
  language: AppLanguage;
  locale: Locale;
  activeOccurrence: ExpenseOccurrence | null;
  activeDropTarget: DropTarget | null;
  onTogglePaid: (occurrence: ExpenseOccurrence) => void;
};

export function TimelineDayGroup({
  day,
  items,
  categories,
  today,
  language,
  locale,
  activeOccurrence,
  activeDropTarget,
  onTogglePaid,
}: TimelineDayGroupProps) {
  return (
    <div className="space-y-1.5">
      <TimelineEmptyDayTarget
        date={day}
        active={activeDropTarget?.date === day && !activeDropTarget.rowId}
        locale={locale}
      />
      {items.map((occurrence) => (
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
    </div>
  );
}
