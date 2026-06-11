import type { Locale } from "date-fns";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { DropTarget } from "../../hooks/use-expense-dnd";
import { TimelineEmptyDayTarget } from "../TimelineEmptyDayTarget";

type TimelineDayTargetsProps = {
  dates: string[];
  activeDropTarget: DropTarget | null;
  language: AppLanguage;
  locale: Locale;
};

export function TimelineDayTargets({
  dates,
  activeDropTarget,
  language,
  locale,
}: TimelineDayTargetsProps) {
  return dates.map((day) => (
    <TimelineEmptyDayTarget
      key={day}
      date={day}
      active={activeDropTarget?.date === day && !activeDropTarget.rowId}
      label={t("expenses.dropHere", language)}
      locale={locale}
    />
  ));
}
