import type { Locale } from "date-fns";
import type { DropTarget } from "../../hooks/use-expense-dnd";
import { TimelineEmptyDayTarget } from "../TimelineEmptyDayTarget";

type TimelineDayTargetsProps = {
  dates: string[];
  activeDropTarget: DropTarget | null;
  locale: Locale;
};

export function TimelineDayTargets({
  dates,
  activeDropTarget,
  locale,
}: TimelineDayTargetsProps) {
  return dates.map((day) => (
    <TimelineEmptyDayTarget
      key={day}
      date={day}
      active={activeDropTarget?.date === day && !activeDropTarget.rowId}
      locale={locale}
    />
  ));
}
